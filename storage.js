'use strict';

// Persistence: localStorage per year + optional sync to a private GitHub repo
// (data/<year>.json) through the GitHub REST contents API.
const Store = (() => {
  const P = 'ts:';
  const API = 'https://api.github.com';

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // ---- Year data ----
  function emptyYear(year) {
    return { version: 2, year, updated: new Date().toISOString(), days: {} };
  }
  function loadYear(year) {
    const d = readJSON(P + year, null);
    return d && d.days ? d : emptyYear(year);
  }
  function saveYear(year, data) {
    data.version = 2;
    data.year = year;
    data.updated = new Date().toISOString();
    writeJSON(P + year, data);
  }
  function localYears() {
    const years = [];
    for (let i = 0; i < localStorage.length; i++) {
      const m = /^ts:(\d{4})$/.exec(localStorage.key(i));
      if (m) years.push(+m[1]);
    }
    return years;
  }

  // ---- Dirty dates (changed since last successful push) ----
  function getDirty(year) {
    return readJSON(P + 'dirty:' + year, []);
  }
  function markDirty(year, dates) {
    const set = new Set(getDirty(year));
    dates.forEach(d => set.add(d));
    writeJSON(P + 'dirty:' + year, [...set]);
  }
  function setDirty(year, dates) {
    if (dates.length) writeJSON(P + 'dirty:' + year, dates);
    else localStorage.removeItem(P + 'dirty:' + year);
  }
  function dirtyYears() {
    return localYears().filter(y => getDirty(y).length > 0);
  }

  // ---- Settings ----
  function getSettings() {
    return readJSON(P + 'settings', {});
  }
  function updateSettings(patch) {
    const s = { ...getSettings(), ...patch };
    writeJSON(P + 'settings', s);
    return s;
  }

  // ---- Gym program (synced) and in-progress session (local only) ----
  function loadPlan() {
    return readJSON(P + 'plan', { text: '' }).text || '';
  }
  function savePlan(text) {
    writeJSON(P + 'plan', { text, updated: new Date().toISOString() });
    localStorage.setItem(P + 'plan:dirty', '1');
  }
  function planDirty() {
    return localStorage.getItem(P + 'plan:dirty') === '1';
  }
  function getSession() {
    return readJSON(P + 'session', null);
  }
  function saveSession(session) {
    if (session) writeJSON(P + 'session', session);
    else localStorage.removeItem(P + 'session');
  }

  // ---- Import / export ----
  // Accepts a single year object, { years: [...] } or an array of year objects.
  function parseImport(text) {
    const obj = JSON.parse(text);
    const list = Array.isArray(obj) ? obj : Array.isArray(obj.years) ? obj.years : [obj];
    return list.map(y => {
      if (!y || typeof y.days !== 'object' || Array.isArray(y.days)) {
        throw new Error('Tuntematon muoto: odotettiin { year, days: { "YYYY-MM-DD": {...} } }');
      }
      const dates = Object.keys(y.days);
      const year = +y.year || (dates[0] ? +dates[0].slice(0, 4) : NaN);
      if (!year) throw new Error('Vuosi puuttuu');
      const bad = dates.find(d => !/^\d{4}-\d{2}-\d{2}$/.test(d) || +d.slice(0, 4) !== year);
      if (bad) throw new Error(`Virheellinen päivämäärä ${bad} vuodelle ${year}`);
      return { year, days: y.days };
    });
  }

  // mode: 'merge' (incoming days overwrite same dates) or 'replace' (whole year replaced)
  function applyImport(yearObjs, mode) {
    const result = [];
    for (const { year, days } of yearObjs) {
      const local = loadYear(year);
      let changed;
      if (mode === 'replace') {
        changed = [...new Set([...Object.keys(local.days), ...Object.keys(days)])];
        local.days = { ...days };
      } else {
        changed = Object.keys(days);
        Object.assign(local.days, days);
      }
      saveYear(year, local);
      markDirty(year, changed);
      result.push({ year, count: Object.keys(days).length });
    }
    return result;
  }

  function exportYear(year) {
    const d = loadYear(year);
    return JSON.stringify({ version: 2, year, updated: d.updated, days: sortDays(d.days) }, null, 1);
  }
  function exportAll() {
    const years = localYears().sort().map(y => {
      const d = loadYear(y);
      return { version: 2, year: y, updated: d.updated, days: sortDays(d.days) };
    });
    return JSON.stringify({ version: 2, years }, null, 1);
  }
  function sortDays(days) {
    return Object.fromEntries(Object.entries(days).sort(([a], [b]) => a.localeCompare(b)));
  }

  // ---- GitHub sync ----
  function syncConfig() {
    const s = getSettings().sync || {};
    if (!s.owner || !s.repo || !s.token) return null;
    return { owner: s.owner.trim(), repo: s.repo.trim(), branch: (s.branch || 'main').trim(), token: s.token.trim() };
  }

  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
  }

  class SyncError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }

  async function gh(path, opts = {}, cfg = syncConfig()) {
    const headers = { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    let res;
    try {
      const url = `${API}/repos/${cfg.owner}/${cfg.repo}` + (path ? `/${path}` : '');
      res = await fetch(url, { ...opts, headers, cache: 'no-store' });
    } catch {
      throw new SyncError(0, 'Ei verkkoyhteyttä');
    }
    return res;
  }

  async function failure(res) {
    let msg = '';
    try { msg = (await res.json()).message || ''; } catch { /* ignore */ }
    if (res.status === 401) return new SyncError(401, 'Token virheellinen tai vanhentunut');
    if (res.status === 403) return new SyncError(403, 'Ei oikeuksia (tarkista tokenin Contents-oikeus)');
    if (res.status === 404) return new SyncError(404, 'Repoa tai haaraa ei löydy');
    return new SyncError(res.status, `GitHub-virhe ${res.status} ${msg}`.trim());
  }

  function shaKey(year) { return P + 'sha:' + year; }
  function filePath(year) { return `contents/data/${year}.json`; }

  // Remote file wins except for locally dirty dates. Returns true if local data changed.
  async function pull(year) {
    const cfg = syncConfig();
    const res = await gh(`${filePath(year)}?ref=${encodeURIComponent(cfg.branch)}`, {}, cfg);
    if (res.status === 404) {
      const local = loadYear(year);
      localStorage.removeItem(shaKey(year));
      const dates = Object.keys(local.days);
      if (dates.length) markDirty(year, dates);
      return false;
    }
    if (!res.ok) throw await failure(res);
    const file = await res.json();
    const remote = JSON.parse(b64decode(file.content));
    localStorage.setItem(shaKey(year), file.sha);
    const local = loadYear(year);
    const days = { ...(remote.days || {}) };
    for (const d of getDirty(year)) {
      if (local.days[d]) days[d] = local.days[d];
      else delete days[d];
    }
    const changed = JSON.stringify(sortDays(days)) !== JSON.stringify(sortDays(local.days));
    if (changed) {
      local.days = days;
      saveYear(year, local);
    }
    return changed;
  }

  async function push(year, isRetry = false) {
    const dirty = getDirty(year);
    if (!dirty.length) return;
    const cfg = syncConfig();
    const data = loadYear(year);
    const pushedDays = JSON.parse(JSON.stringify(data.days));
    const body = {
      message: `Päivitys ${year} (${dirty.length} pv)`,
      content: b64encode(exportYear(year)),
      branch: cfg.branch,
    };
    const sha = localStorage.getItem(shaKey(year));
    if (sha) body.sha = sha;
    const res = await gh(filePath(year), { method: 'PUT', body: JSON.stringify(body) }, cfg);
    if ((res.status === 409 || res.status === 422) && !isRetry) {
      await pull(year);
      return push(year, true);
    }
    if (!res.ok) throw await failure(res);
    const out = await res.json();
    localStorage.setItem(shaKey(year), out.content.sha);
    // Keep dates edited while the request was in flight.
    const now = loadYear(year).days;
    setDirty(year, getDirty(year).filter(d => JSON.stringify(now[d]) !== JSON.stringify(pushedDays[d])));
  }

  const PLAN_PATH = 'contents/data/saliohjelma.txt';
  const PLAN_SHA = P + 'sha:plan';

  // Remote wins unless the local program has unpushed edits.
  async function pullPlan() {
    const cfg = syncConfig();
    const res = await gh(`${PLAN_PATH}?ref=${encodeURIComponent(cfg.branch)}`, {}, cfg);
    if (res.status === 404) {
      localStorage.removeItem(PLAN_SHA);
      if (loadPlan()) localStorage.setItem(P + 'plan:dirty', '1');
      return;
    }
    if (!res.ok) throw await failure(res);
    const file = await res.json();
    localStorage.setItem(PLAN_SHA, file.sha);
    if (!planDirty()) writeJSON(P + 'plan', { text: b64decode(file.content), updated: new Date().toISOString() });
  }

  async function pushPlan(isRetry = false) {
    if (!planDirty()) return;
    const cfg = syncConfig();
    const text = loadPlan();
    const body = { message: 'Saliohjelma', content: b64encode(text), branch: cfg.branch };
    const sha = localStorage.getItem(PLAN_SHA);
    if (sha) body.sha = sha;
    const res = await gh(PLAN_PATH, { method: 'PUT', body: JSON.stringify(body) }, cfg);
    if ((res.status === 409 || res.status === 422) && !isRetry) {
      await pullPlan();
      return pushPlan(true);
    }
    if (!res.ok) throw await failure(res);
    const out = await res.json();
    localStorage.setItem(PLAN_SHA, out.content.sha);
    if (loadPlan() === text) localStorage.removeItem(P + 'plan:dirty');
  }

  async function syncPlan() {
    await pullPlan();
    await pushPlan();
  }

  async function remoteYears() {
    const cfg = syncConfig();
    const res = await gh(`contents/data?ref=${encodeURIComponent(cfg.branch)}`, {}, cfg);
    if (res.status === 404) return [];
    if (!res.ok) throw await failure(res);
    const list = await res.json();
    return Array.isArray(list)
      ? list.map(f => /^(\d{4})\.json$/.exec(f.name)).filter(Boolean).map(m => +m[1])
      : [];
  }

  async function testConnection(cfg) {
    const res = await gh('', {}, cfg);
    if (!res.ok) throw await failure(res);
    const repo = await res.json();
    if (repo.permissions && !repo.permissions.push) {
      throw new SyncError(403, 'Tokenilla ei ole kirjoitusoikeutta');
    }
    return repo;
  }

  return {
    loadYear, saveYear, localYears, emptyYear,
    getDirty, markDirty, dirtyYears,
    getSettings, updateSettings,
    loadPlan, savePlan, planDirty, getSession, saveSession, pushPlan, syncPlan,
    parseImport, applyImport, exportYear, exportAll,
    syncConfig, pull, push, remoteYears, testConnection,
  };
})();
