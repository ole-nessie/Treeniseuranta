'use strict';

const MONTHS = ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu',
  'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'];
const WEEKDAYS = ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'];
const WEEKDAYS_SHORT = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];

// Single source of truth for grid, form, summary and chart (mirrors the Excel header row).
// type: bool | int | num | hours | text; sum: count | sum | hours; chart: bar | line
const COLUMNS = [
  { key: 'sick', label: 'Sairaspäivä', short: 'Sairas', type: 'bool', group: 'Yleinen', sum: 'count', chart: 'bar', color: '#5b9bd5' },
  { key: 'compCal', label: 'Kilpailukalenteri', type: 'text', group: 'Jousiammunta' },
  { key: 'arrows', label: 'Nuolien määrä', short: 'Nuolet', type: 'int', group: 'Jousiammunta', sum: 'sum', chart: 'bar', color: '#ed7d31' },
  { key: 'competition', label: 'Kilpailu', type: 'text', group: 'Jousiammunta' },
  { key: 'round1', label: '1. kierros', type: 'int', group: 'Jousiammunta' },
  { key: 'round2', label: '2. kierros', type: 'int', group: 'Jousiammunta' },
  { key: 'result', label: 'Tulos', type: 'int', group: 'Jousiammunta' },
  { key: 'distanceM', label: 'Matka [m]', type: 'int', group: 'Jousiammunta' },
  { key: 'notes', label: 'Muistiinpanoja', type: 'text', multiline: true, group: 'Jousiammunta' },
  { key: 'aerobicH', label: 'Aerobinen [h]', short: 'Aerobinen', type: 'hours', group: 'Aerobinen', sum: 'hours', chart: 'line', color: '#a5a5a5' },
  { key: 'swimKm', label: 'Uinti [km]', short: 'Uinti', type: 'num', group: 'Aerobinen', sum: 'sum', chart: 'line', color: '#ffc000' },
  { key: 'runKm', label: 'Juoksu [km]', short: 'Juoksu', type: 'num', group: 'Aerobinen', sum: 'sum', chart: 'line', color: '#4472c4' },
  { key: 'walkKm', label: 'Kävely [km]', short: 'Kävely', type: 'num', group: 'Aerobinen', sum: 'sum', chart: 'line', color: '#70ad47' },
  { key: 'cycleKm', label: 'Pyöräily [km]', short: 'Pyöräily', type: 'num', group: 'Aerobinen', sum: 'sum', chart: 'line', color: '#264478' },
  { key: 'skiKm', label: 'Hiihto [km]', short: 'Hiihto', type: 'num', group: 'Aerobinen', sum: 'sum', chart: 'line', color: '#9e480e' },
  { key: 'aerobicNotes', label: 'Aerobinen, muistiinpanot', type: 'text', multiline: true, group: 'Aerobinen' },
  { key: 'careH', label: 'Lihashuolto [h]', short: 'Lihashuolto', type: 'hours', group: 'Lihaskunto / huolto', sum: 'hours', chart: 'line', color: '#636363' },
  { key: 'careNotes', label: 'Lihashuolto, muistiinpanot', type: 'text', multiline: true, group: 'Lihaskunto / huolto' },
  { key: 'gymH', label: 'Lihaskunto [h]', short: 'Lihaskunto', type: 'hours', group: 'Lihaskunto / huolto', sum: 'hours', chart: 'line', color: '#997300' },
  { key: 'gymNotes', label: 'Lihaskunto, muistiinpanot', type: 'text', multiline: true, group: 'Lihaskunto / huolto' },
  { key: 'climbH', label: 'Kiipeily [h]', short: 'Kiipeily', type: 'hours', group: 'Lihaskunto / huolto', sum: 'hours', chart: 'line', color: '#2f5597' },
  { key: 'climbNotes', label: 'Kiipeily, muistiinpanot', type: 'text', multiline: true, group: 'Lihaskunto / huolto' },
];
const COL = Object.fromEntries(COLUMNS.map(c => [c.key, c]));
const GROUPS = [...new Set(COLUMNS.map(c => c.group))];
const SUMMED = COLUMNS.filter(c => c.sum);
const DEFAULT_OPEN_GROUPS = ['Aerobinen', 'Lihaskunto / huolto'];

const NUM = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 });
const NUM2 = new Intl.NumberFormat('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const state = {
  year: new Date().getFullYear(),
  data: null,
  remoteYears: [],
  editing: null,
  formOrigDate: null,
  formAdd: false,
  chart: null,
};

const $ = id => document.getElementById(id);

// ---- Helpers ----
function pad2(n) { return String(n).padStart(2, '0'); }
function isoDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayIso() { return isoDate(new Date()); }
function parseIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function fiDate(s) { const d = parseIso(s); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; }
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function daysOfYear(year) {
  const out = [];
  for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
    out.push({ date: isoDate(d), month: d.getMonth(), weekday: d.getDay(), dom: d.getDate() });
  }
  return out;
}

function hoursToMin(s) {
  const m = /^(\d+):(\d{2})$/.exec(s || '');
  return m ? +m[1] * 60 + +m[2] : 0;
}
function minToHours(min) {
  return `${Math.floor(min / 60)}:${pad2(min % 60)}`;
}

// Returns { ok, value } where value === undefined means "clear the field".
function parseInput(col, raw) {
  if (col.type === 'bool') return { ok: true, value: raw ? true : undefined };
  const s = String(raw ?? '').trim();
  if (!s) return { ok: true, value: undefined };
  switch (col.type) {
    case 'text':
      return { ok: true, value: s };
    case 'int': {
      if (!/^\d+$/.test(s)) return { ok: false };
      const v = parseInt(s, 10);
      return { ok: true, value: v || undefined };
    }
    case 'num': {
      const t = s.replace(',', '.');
      if (!/^\d*\.?\d+$/.test(t)) return { ok: false };
      const v = Math.round(parseFloat(t) * 100) / 100;
      return { ok: true, value: v || undefined };
    }
    case 'hours': {
      // Accept h:mm, h.mm, h,mm or whole hours.
      const m = /^(\d{1,3})(?:[:.,](\d{2}))?$/.exec(s);
      if (!m || (m[2] && +m[2] > 59)) return { ok: false };
      const min = +m[1] * 60 + (m[2] ? +m[2] : 0);
      return { ok: true, value: min ? minToHours(min) : undefined };
    }
  }
  return { ok: false };
}

function displayValue(col, v) {
  if (v === undefined || v === null || v === '') return '';
  if (col.type === 'bool') return v ? '✓' : '';
  if (col.type === 'num') return NUM.format(v);
  if (col.type === 'text') return String(v).split('\n')[0];
  return String(v);
}
function editValue(col, v) {
  if (v === undefined || v === null) return '';
  if (col.type === 'num') return String(v).replace('.', ',');
  return String(v);
}

// ---- Summary ----
function computeSummary(days) {
  const months = Array.from({ length: 12 }, () => ({}));
  const total = {};
  for (const [date, day] of Object.entries(days)) {
    const m = +date.slice(5, 7) - 1;
    for (const col of SUMMED) {
      const v = day[col.key];
      if (v === undefined) continue;
      const amount = col.sum === 'count' ? 1 : col.sum === 'hours' ? hoursToMin(v) : +v;
      months[m][col.key] = (months[m][col.key] || 0) + amount;
      total[col.key] = (total[col.key] || 0) + amount;
    }
  }
  return { months, total };
}

function summaryCell(col, v) {
  if (!v) return '';
  if (col.sum === 'hours') return minToHours(v);
  if (col.type === 'num') return NUM2.format(v);
  return String(Math.round(v));
}

function renderSummary(summary) {
  $('summary-year').textContent = state.year;
  const head = `<thead><tr><th>Kuukausi</th>${SUMMED.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>`;
  const rows = summary.months.map((m, i) =>
    `<tr><th>${MONTHS[i]}</th>${SUMMED.map(c => `<td>${summaryCell(c, m[c.key])}</td>`).join('')}</tr>`).join('');
  const foot = `<tfoot><tr><th>Kaikki yhteensä</th>${SUMMED.map(c => `<td>${summaryCell(c, summary.total[c.key])}</td>`).join('')}</tr></tfoot>`;
  $('summary').innerHTML = head + `<tbody>${rows}</tbody>` + foot;
}

// ---- Chart ----
function chartDatasets(summary) {
  const hidden = new Set(Store.getSettings().hiddenSeries || []);
  return SUMMED.map(col => {
    const data = summary.months.map(m => {
      const v = m[col.key];
      if (!v) return null;
      return col.sum === 'hours' ? Math.round(v / 60 * 100) / 100 : v;
    });
    const isHours = col.sum === 'hours';
    return {
      key: col.key,
      label: col.short || col.label,
      type: col.chart,
      data,
      yAxisID: isHours ? 'y1' : 'y',
      borderColor: col.color,
      backgroundColor: col.color,
      borderWidth: 2,
      pointRadius: 3,
      tension: 0,
      spanGaps: false,
      hidden: hidden.has(col.key),
      order: col.chart === 'bar' ? 2 : 1,
    };
  });
}

function renderChart(summary) {
  if (!window.Chart) {
    $('chart-missing').hidden = false;
    return;
  }
  $('chart-missing').hidden = true;
  const datasets = chartDatasets(summary);
  if (state.chart) {
    state.chart.data.datasets.forEach((ds, i) => { ds.data = datasets[i].data; });
    state.chart.update();
    return;
  }
  const hoursTick = v => minToHours(Math.round(v * 60));
  state.chart = new Chart($('chart'), {
    type: 'line',
    data: { labels: MONTHS, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { beginAtZero: true, position: 'left', title: { display: true, text: 'km / nuolet / pv' } },
        y1: {
          beginAtZero: true, position: 'right', grid: { drawOnChartArea: false },
          title: { display: true, text: 'tuntia' }, ticks: { callback: hoursTick },
        },
      },
      plugins: {
        legend: {
          position: window.innerWidth < 700 ? 'bottom' : 'right',
          onClick(e, item, legend) {
            Chart.defaults.plugins.legend.onClick.call(this, e, item, legend);
            const hidden = legend.chart.data.datasets
              .filter((ds, i) => !legend.chart.isDatasetVisible(i)).map(ds => ds.key);
            Store.updateSettings({ hiddenSeries: hidden });
          },
        },
        tooltip: {
          filter: item => item.raw !== null,
          callbacks: {
            label(ctx) {
              const v = ctx.raw;
              const shown = ctx.dataset.yAxisID === 'y1' ? hoursTick(v) : NUM.format(v);
              return `${ctx.dataset.label}: ${shown}`;
            },
          },
        },
      },
    },
  });
}

// ---- Day grid (desktop) ----
function renderGrid() {
  const groupCells = [];
  for (const g of GROUPS) {
    const n = COLUMNS.filter(c => c.group === g).length;
    groupCells.push(`<th colspan="${n}" class="group">${g === 'Yleinen' ? '' : esc(g)}</th>`);
  }
  const head = `<thead>
    <tr class="r1"><th class="c-date"></th><th></th><th></th>${groupCells.join('')}</tr>
    <tr class="r2"><th class="c-date">Päivämäärä</th><th>Kuukausi</th><th>Päivä</th>${
      COLUMNS.map(c => `<th class="t-${c.type}${c.multiline ? ' wide' : ''}">${esc(c.label)}</th>`).join('')}</tr>
  </thead>`;
  const today = todayIso();
  const rows = daysOfYear(state.year).map(d => {
    const day = state.data.days[d.date];
    const cls = [
      d.weekday === 0 || d.weekday === 6 ? 'weekend' : '',
      d.dom === 1 ? 'month-start' : '',
      d.date === today ? 'today' : '',
      day ? 'filled' : '',
    ].filter(Boolean).join(' ');
    const cells = COLUMNS.map(c => cellHtml(c, day && day[c.key])).join('');
    return `<tr data-date="${d.date}" class="${cls}"><td class="c-date">${fiDate(d.date)}</td><td class="c-meta">${MONTHS[d.month]}</td><td class="c-meta">${WEEKDAYS[d.weekday]}</td>${cells}</tr>`;
  }).join('');
  $('grid').innerHTML = head + `<tbody>${rows}</tbody>`;
}

function cellHtml(col, v) {
  const title = col.type === 'text' && v ? ` title="${esc(v)}"` : '';
  return `<td data-key="${col.key}" class="t-${col.type}${col.multiline ? ' wide' : ''}"${title}>${esc(displayValue(col, v))}</td>`;
}

function refreshRow(date) {
  const tr = $('grid').querySelector(`tr[data-date="${date}"]`);
  if (!tr) return;
  const day = state.data.days[date];
  tr.classList.toggle('filled', !!day);
  tr.querySelectorAll('td[data-key]').forEach(td => {
    const col = COL[td.dataset.key];
    const v = day && day[col.key];
    td.classList.remove('editing', 'invalid');
    td.textContent = displayValue(col, v);
    if (col.type === 'text' && v) td.title = v;
    else td.removeAttribute('title');
  });
}

function startEdit(td) {
  const date = td.parentElement.dataset.date;
  const key = td.dataset.key;
  if (state.editing && !commitEdit()) return;
  const col = COL[key];
  const cur = (state.data.days[date] || {})[key];
  let el;
  if (col.type === 'bool') {
    el = document.createElement('input');
    el.type = 'checkbox';
    el.checked = !!cur;
  } else if (col.type === 'text') {
    el = document.createElement('textarea');
    el.value = cur || '';
    el.rows = Math.min(8, Math.max(2, (cur || '').split('\n').length));
  } else {
    el = document.createElement('input');
    el.type = 'text';
    el.inputMode = col.type === 'hours' ? 'text' : 'decimal';
    el.placeholder = col.type === 'hours' ? 'h:mm' : '';
    el.value = editValue(col, cur);
  }
  td.classList.add('editing');
  td.classList.remove('invalid');
  td.textContent = '';
  td.appendChild(el);
  state.editing = { td, el, date, key };
  el.addEventListener('keydown', onEditKey);
  el.addEventListener('blur', () => {
    if (state.editing && state.editing.el === el && !commitEdit()) cancelEdit();
  });
  el.focus();
  if (el.select) el.select();
  td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function readEditor() {
  const { el } = state.editing;
  return el.type === 'checkbox' ? el.checked : el.value;
}

function commitEdit() {
  const ed = state.editing;
  if (!ed) return true;
  const col = COL[ed.key];
  const res = parseInput(col, readEditor());
  if (!res.ok) {
    ed.td.classList.add('invalid');
    return false;
  }
  state.editing = null;
  setValue(ed.date, ed.key, res.value);
  refreshRow(ed.date);
  return true;
}

function cancelEdit() {
  const ed = state.editing;
  if (!ed) return;
  state.editing = null;
  refreshRow(ed.date);
}

function cellAt(date, key) {
  return $('grid').querySelector(`tr[data-date="${date}"] td[data-key="${key}"]`);
}

function onEditKey(e) {
  const ed = state.editing;
  if (!ed) return;
  const { date, key } = ed;
  if (e.key === 'Escape') {
    e.preventDefault();
    cancelEdit();
    return;
  }
  const isTextarea = ed.el.tagName === 'TEXTAREA';
  if ((e.key === 'Enter' && !(isTextarea && e.shiftKey)) || e.key === 'Tab') {
    e.preventDefault();
    if (!commitEdit()) return;
    const next = e.key === 'Tab' ? neighbour(date, key, e.shiftKey ? -1 : 1) : below(date, key, e.shiftKey ? -1 : 1);
    if (next) startEdit(next);
  }
}

function neighbour(date, key, dir) {
  const i = COLUMNS.findIndex(c => c.key === key) + dir;
  return i >= 0 && i < COLUMNS.length ? cellAt(date, COLUMNS[i].key) : null;
}

function below(date, key, dir) {
  let tr = cellAt(date, key).parentElement;
  do {
    tr = dir > 0 ? tr.nextElementSibling : tr.previousElementSibling;
  } while (tr && tr.offsetParent === null);
  return tr ? tr.querySelector(`td[data-key="${key}"]`) : null;
}

function onGridClick(e) {
  const td = e.target.closest('td[data-key]');
  if (!td || td.classList.contains('editing')) return;
  const col = COL[td.dataset.key];
  if (col.type === 'bool') {
    const date = td.parentElement.dataset.date;
    if (state.editing && !commitEdit()) return;
    const cur = (state.data.days[date] || {})[col.key];
    setValue(date, col.key, cur ? undefined : true);
    refreshRow(date);
    return;
  }
  startEdit(td);
}

function onGridDblClick(e) {
  const td = e.target.closest('td.c-date, td.c-meta');
  if (td) openForm(td.parentElement.dataset.date);
}

// ---- Mobile list ----
function renderList() {
  const entries = Object.entries(state.data.days).sort(([a], [b]) => b.localeCompare(a));
  if (!entries.length) {
    $('day-list').innerHTML = '<li class="empty">Ei merkintöjä tälle vuodelle.</li>';
    return;
  }
  $('day-list').innerHTML = entries.map(([date, day]) => {
    const d = parseIso(date);
    const chips = COLUMNS.filter(c => c.type !== 'text' && day[c.key] !== undefined).map(c => {
      const name = c.short || c.label;
      if (c.type === 'bool') return `<span class="chip">${esc(name)}</span>`;
      const unit = c.type === 'num' ? ' km' : '';
      return `<span class="chip">${esc(name)} ${esc(displayValue(c, day[c.key]))}${unit}</span>`;
    }).join('');
    const note = COLUMNS.filter(c => c.type === 'text' && day[c.key]).map(c => day[c.key].split('\n')[0])[0] || '';
    return `<li data-date="${date}" class="${date === todayIso() ? 'today' : ''}">
      <div class="li-date">${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.</div>
      <div class="li-body"><div class="chips">${chips}</div>${note ? `<div class="li-note">${esc(note)}</div>` : ''}</div>
    </li>`;
  }).join('');
}

// ---- Day form ----
function buildForm() {
  $('form-groups').innerHTML = GROUPS.map(g => {
    const fields = COLUMNS.filter(c => c.group === g).map(c => {
      const id = `f-${c.key}`;
      if (c.type === 'bool') {
        return `<label class="check"><input type="checkbox" id="${id}"> ${esc(c.label)}</label>`;
      }
      if (c.multiline) {
        return `<label class="field full"><span>${esc(c.label)}</span><textarea id="${id}" rows="3"></textarea></label>`;
      }
      const mode = c.type === 'text' ? 'text' : c.type === 'int' ? 'numeric' : c.type === 'num' ? 'decimal' : 'text';
      const ph = c.type === 'hours' ? 'h:mm' : '';
      return `<label class="field"><span>${esc(c.label)}</span><input id="${id}" inputmode="${mode}" placeholder="${ph}" autocomplete="off"></label>`;
    }).join('');
    return `<details class="group" data-group="${esc(g)}"><summary>${esc(g)}</summary><div class="fields">${fields}</div></details>`;
  }).join('');
}

// Opened without a date ("Lisää merkintä"): picking another date loads that date's entry.
// Opened for an existing row: changing the date moves the entry.
function openForm(date) {
  if (state.editing) commitEdit();
  state.formAdd = !date;
  date = date || (String(state.year) === todayIso().slice(0, 4) ? todayIso() : `${state.year}-01-01`);
  const day = loadDay(date);
  state.formOrigDate = day ? date : null;
  $('f-date').value = date;
  fillForm(day || {});
  $('f-delete').hidden = !day;
  $('day-dialog').showModal();
}

function fillForm(day) {
  for (const c of COLUMNS) {
    const el = $(`f-${c.key}`);
    el.classList.remove('invalid');
    if (c.type === 'bool') el.checked = !!day[c.key];
    else el.value = editValue(c, day[c.key]);
  }
  const empty = !Object.keys(day).length;
  document.querySelectorAll('#form-groups details').forEach(det => {
    const g = det.dataset.group;
    det.open = empty
      ? DEFAULT_OPEN_GROUPS.includes(g)
      : COLUMNS.some(c => c.group === g && day[c.key] !== undefined);
  });
}

function loadDay(date) {
  const year = +date.slice(0, 4);
  const data = year === state.year ? state.data : Store.loadYear(year);
  return data.days[date];
}

function onFormDateChange() {
  const date = $('f-date').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const day = loadDay(date);
  if (state.formAdd) {
    state.formOrigDate = day ? date : null;
    fillForm(day || {});
    $('f-delete').hidden = !day;
  } else if (day && date !== state.formOrigDate) {
    alert(`Päivällä ${fiDate(date)} on jo merkintöjä. Avaa se erikseen tai valitse toinen päivä.`);
    $('f-date').value = state.formOrigDate;
  }
}

function saveForm(e) {
  e.preventDefault();
  const date = $('f-date').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    $('f-date').focus();
    return;
  }
  const day = {};
  let firstBad = null;
  for (const c of COLUMNS) {
    const el = $(`f-${c.key}`);
    const res = parseInput(c, c.type === 'bool' ? el.checked : el.value);
    el.classList.toggle('invalid', !res.ok);
    if (!res.ok) { firstBad = firstBad || el; continue; }
    if (res.value !== undefined) day[c.key] = res.value;
  }
  if (firstBad) {
    firstBad.closest('details').open = true;
    firstBad.focus();
    return;
  }
  if (state.formOrigDate && state.formOrigDate !== date) writeDay(state.formOrigDate, null);
  writeDay(date, day);
  $('day-dialog').close();
}

function deleteFromForm() {
  const date = state.formOrigDate;
  if (!date || !confirm(`Poistetaanko päivän ${fiDate(date)} merkinnät?`)) return;
  writeDay(date, null);
  $('day-dialog').close();
}

// ---- Gym view ----
const MAX_SESSION_MIN = 4 * 60;

function cleanLines(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

function elapsedHours(session) {
  if (!session || !session.start) return '';
  const min = Math.round((Date.now() - session.start) / 60000 / 5) * 5;
  return min > 0 && min <= MAX_SESSION_MIN ? minToHours(min) : '';
}

function openGym() {
  if (state.editing) commitEdit();
  $('g-plan').value = Store.loadPlan();
  renderSession();
  $('g-update-plan').checked = false;
  $('gym-dialog').showModal();
  if (Store.syncConfig()) {
    runExclusive(() => Store.syncPlan()).then(() => {
      if (document.activeElement !== $('g-plan')) $('g-plan').value = Store.loadPlan();
    });
  }
}

function renderSession() {
  const s = Store.getSession();
  const date = (s && s.date) || todayIso();
  $('g-session').value = s ? s.text : prefillFor(date);
  $('g-date').value = date;
  $('g-duration').value = (s && s.duration) || '';
  $('g-duration').classList.remove('invalid');
  renderElapsed(s);
}

function prefillFor(date) {
  return (loadDay(date) || {}).gymNotes || lastGymNotes(date);
}

function onSessionDateInput() {
  const date = $('g-date').value;
  if (Store.getSession() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) onSessionInput();
  else $('g-session').value = prefillFor(date);
}

function renderElapsed(s) {
  $('g-duration').placeholder = elapsedHours(s) || 'h:mm';
  const start = s && s.start ? new Date(s.start) : null;
  $('g-started').textContent = start ? `Aloitettu ${pad2(start.getHours())}:${pad2(start.getMinutes())}` : '';
}

// The start time is set by the first non-empty edit; an empty duration at commit uses the elapsed time.
function onSessionInput() {
  const s = { ...(Store.getSession() || {}), text: $('g-session').value, date: $('g-date').value, duration: $('g-duration').value };
  if (!s.start && s.text.trim()) s.start = Date.now();
  Store.saveSession(s);
  renderElapsed(s);
}

function fillSession(text) {
  if (!text) return;
  if (Store.getSession() && cleanLines($('g-session').value) && !confirm('Korvataanko nykyinen treeniteksti?')) return;
  $('g-session').value = text;
  onSessionInput();
  $('g-session').focus();
}

function lastGymNotes(before) {
  const year = +before.slice(0, 4);
  for (const y of [year, year - 1]) {
    const days = (y === state.year ? state.data : Store.loadYear(y)).days;
    const date = Object.keys(days).filter(d => d < before && days[d].gymNotes).sort().pop();
    if (date) return days[date].gymNotes;
  }
  return '';
}

function commitSession() {
  const text = cleanLines($('g-session').value);
  const date = $('g-date').value;
  if (!text) { $('g-session').focus(); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('g-date').focus(); return; }
  const dur = parseInput(COL.gymH, $('g-duration').value || elapsedHours(Store.getSession()));
  $('g-duration').classList.toggle('invalid', !dur.ok);
  if (!dur.ok) { $('g-duration').focus(); return; }
  const existing = loadDay(date) || {};
  if (existing.gymNotes && existing.gymNotes !== text &&
      !confirm(`Päivällä ${fiDate(date)} on jo salimerkintä:\n\n${existing.gymNotes}\n\nKorvataanko?`)) return;
  const day = { ...existing, gymNotes: text };
  if (dur.value) day.gymH = dur.value;
  if ($('g-update-plan').checked) {
    Store.savePlan(text);
    $('g-plan').value = text;
  }
  Store.saveSession(null);
  writeDay(date, day);
  $('gym-dialog').close();
}

function discardSession() {
  if (Store.getSession() && !confirm('Hylätäänkö treeni kirjaamatta?')) return;
  Store.saveSession(null);
  renderSession();
}

// ---- Mutations ----
// Mutations start from localStorage because a background sync may have merged remote changes.
function setValue(date, key, value) {
  state.data = Store.loadYear(state.year);
  const day = { ...(state.data.days[date] || {}) };
  if (value === undefined) delete day[key];
  else day[key] = value;
  if (Object.keys(day).length) state.data.days[date] = day;
  else delete state.data.days[date];
  persist(state.year, [date]);
}

// Replaces a whole day (null/empty removes it). Switches year if needed.
function writeDay(date, day) {
  const year = +date.slice(0, 4);
  const data = Store.loadYear(year);
  if (year === state.year) state.data = data;
  if (day && Object.keys(day).length) data.days[date] = day;
  else delete data.days[date];
  if (year === state.year) {
    persist(year, [date]);
    refreshRow(date);
  } else {
    Store.saveYear(year, data);
    Store.markDirty(year, [date]);
    scheduleSync();
    setYear(year);
  }
}

function persist(year, dates) {
  Store.saveYear(year, state.data);
  Store.markDirty(year, dates);
  scheduleDerived();
  scheduleSync();
}

let derivedTimer = null;
function scheduleDerived() {
  clearTimeout(derivedTimer);
  derivedTimer = setTimeout(renderDerived, 50);
}

function renderDerived() {
  const summary = computeSummary(state.data.days);
  renderSummary(summary);
  renderChart(summary);
  renderList();
  updateStatus();
}

function renderAll() {
  renderGrid();
  renderDerived();
  renderYearSelect();
}

// ---- Years ----
function knownYears() {
  return [...new Set([...Store.localYears(), ...state.remoteYears, new Date().getFullYear(), state.year])]
    .sort((a, b) => b - a);
}

function renderYearSelect() {
  $('year-select').innerHTML = knownYears().map(y => `<option value="${y}"${y === state.year ? ' selected' : ''}>${y}</option>`).join('');
}

async function setYear(year) {
  if (state.editing && !commitEdit()) cancelEdit();
  state.year = year;
  state.data = Store.loadYear(year);
  renderAll();
  if (Store.syncConfig()) await syncYear(year);
}

// ---- Sync orchestration ----
let syncTimer = null;
let syncRunning = null;
let lastSyncError = null;
let lastSyncAt = null;

function scheduleSync(delay = 3000) {
  updateStatus();
  if (!Store.syncConfig()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncAll(), delay);
}

async function runExclusive(fn) {
  while (syncRunning) await syncRunning;
  const run = (async () => {
    setStatus('Synkronoidaan…', 'busy');
    try {
      await fn();
      lastSyncError = null;
      lastSyncAt = new Date();
    } catch (err) {
      lastSyncError = err;
      console.error(err);
    }
  })();
  syncRunning = run;
  await run;
  if (syncRunning === run) syncRunning = null;
  reloadIfChanged();
  updateStatus();
}

function reloadIfChanged() {
  const fresh = Store.loadYear(state.year);
  if (JSON.stringify(fresh.days) === JSON.stringify(state.data.days)) return;
  const changed = new Set([...Object.keys(fresh.days), ...Object.keys(state.data.days)]);
  state.data = fresh;
  for (const date of changed) {
    if (!state.editing || state.editing.date !== date) refreshRow(date);
  }
  renderDerived();
}

function syncYear(year) {
  return runExclusive(async () => {
    await Store.pull(year);
    await Store.push(year);
    await Store.syncPlan();
  });
}

function syncAll() {
  clearTimeout(syncTimer);
  return runExclusive(async () => {
    for (const y of Store.dirtyYears()) await Store.push(y);
    await Store.pushPlan();
  });
}

function setStatus(text, kind) {
  const el = $('sync-status');
  el.textContent = text;
  el.dataset.kind = kind;
}

function updateStatus() {
  if (syncRunning) return;
  const cfg = Store.syncConfig();
  $('btn-sync').hidden = !cfg;
  const dirty = Store.getDirty(state.year).length || Store.planDirty();
  if (!cfg) return setStatus('Paikallinen', 'local');
  if (lastSyncError) return setStatus(lastSyncError.message, 'error');
  if (dirty) return setStatus('Tallentamattomia muutoksia', 'dirty');
  if (lastSyncAt) return setStatus(`Synkronoitu ${pad2(lastSyncAt.getHours())}:${pad2(lastSyncAt.getMinutes())}`, 'ok');
  return setStatus('Synkronointi valmis', 'ok');
}

async function manualSync() {
  await syncAll();
  await syncYear(state.year);
  await refreshRemoteYears();
}

async function refreshRemoteYears() {
  if (!Store.syncConfig()) return;
  try {
    state.remoteYears = await Store.remoteYears();
    renderYearSelect();
  } catch (err) {
    lastSyncError = err;
    updateStatus();
  }
}

// ---- Data dialog ----
function importMode() {
  return document.querySelector('input[name="import-mode"]:checked').value;
}

function doImport(texts) {
  try {
    const objs = texts.flatMap(t => Store.parseImport(t));
    const mode = importMode();
    if (mode === 'replace' && !confirm(`Korvataanko vuodet ${objs.map(o => o.year).join(', ')} kokonaan?`)) return;
    const res = Store.applyImport(objs, mode);
    alert('Tuotu:\n' + res.map(r => `${r.year}: ${r.count} päivää`).join('\n'));
    const years = res.map(r => r.year);
    setYear(years.includes(state.year) ? state.year : Math.max(...years));
    scheduleSync(500);
  } catch (err) {
    alert('Tuonti epäonnistui: ' + err.message);
  }
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyYear() {
  const text = Store.exportYear(state.year);
  const ta = $('d-json');
  ta.value = text;
  try {
    await navigator.clipboard.writeText(text);
    $('s-result').textContent = `Vuoden ${state.year} JSON kopioitu leikepöydälle.`;
  } catch {
    ta.focus();
    ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    $('s-result').textContent = ok ? `Vuoden ${state.year} JSON kopioitu.` : 'Kopioi teksti kentästä käsin.';
  }
}

function openData() {
  const s = Store.getSettings().sync || {};
  $('s-owner').value = s.owner || '';
  $('s-repo').value = s.repo || 'treeniseuranta-data';
  $('s-branch').value = s.branch || 'main';
  $('s-token').value = s.token || '';
  $('s-result').textContent = '';
  $('data-dialog').showModal();
}

function readSyncForm() {
  return {
    owner: $('s-owner').value.trim(),
    repo: $('s-repo').value.trim(),
    branch: $('s-branch').value.trim() || 'main',
    token: $('s-token').value.trim(),
  };
}

async function saveSync() {
  const sync = readSyncForm();
  if (!sync.owner || !sync.repo || !sync.token) {
    $('s-result').textContent = 'Täytä omistaja, repo ja token.';
    return;
  }
  Store.updateSettings({ sync });
  $('s-result').textContent = 'Asetukset tallennettu. Synkronoidaan…';
  lastSyncError = null;
  await refreshRemoteYears();
  for (const y of knownYears()) await syncYear(y);
  $('s-result').textContent = lastSyncError ? `Virhe: ${lastSyncError.message}` : 'Synkronoitu.';
}

async function testSync() {
  const cfg = readSyncForm();
  $('s-result').textContent = 'Testataan…';
  try {
    const repo = await Store.testConnection(cfg);
    $('s-result').textContent = `Yhteys OK: ${repo.full_name}${repo.private ? ' (yksityinen)' : ' (HUOM: julkinen repo!)'}`;
  } catch (err) {
    $('s-result').textContent = `Virhe: ${err.message}`;
  }
}

function clearSync() {
  if (!confirm('Poistetaanko synkronointiasetukset tältä laitteelta? Paikalliset tiedot säilyvät.')) return;
  Store.updateSettings({ sync: null });
  state.remoteYears = [];
  lastSyncError = null;
  openData();
  renderAll();
}

function clearYear() {
  state.data = Store.loadYear(state.year);
  const n = Object.keys(state.data.days).length;
  if (!confirm(`Tyhjennetäänkö vuosi ${state.year} (${n} päivää)? Muutos synkronoidaan myös GitHubiin.`)) return;
  const dates = Object.keys(state.data.days);
  state.data.days = {};
  persist(state.year, dates);
  renderGrid();
}

// ---- Init ----
function bind() {
  $('year-prev').onclick = () => setYear(state.year - 1);
  $('year-next').onclick = () => setYear(state.year + 1);
  $('year-select').onchange = e => setYear(+e.target.value);
  $('year-add').onclick = () => {
    const y = parseInt(prompt('Vuosi', String(new Date().getFullYear() + 1)), 10);
    if (y >= 1900 && y <= 2200) setYear(y);
  };
  $('btn-add').onclick = () => openForm();
  $('btn-gym').onclick = openGym;
  $('btn-sync').onclick = manualSync;

  $('g-plan').addEventListener('input', () => {
    Store.savePlan($('g-plan').value);
    scheduleSync();
  });
  ['g-session', 'g-duration'].forEach(id => $(id).addEventListener('input', onSessionInput));
  $('g-date').addEventListener('input', onSessionDateInput);
  $('g-duration').addEventListener('focus', () => renderElapsed(Store.getSession()));
  $('g-from-plan').onclick = () => fillSession(Store.loadPlan());
  $('g-from-last').onclick = () => fillSession(lastGymNotes($('g-date').value || todayIso()));
  $('g-commit').onclick = commitSession;
  $('g-discard').onclick = discardSession;
  $('btn-data').onclick = openData;

  const onlyFilled = !!Store.getSettings().onlyFilled;
  $('only-filled').checked = onlyFilled;
  $('grid').classList.toggle('only-filled', onlyFilled);
  $('only-filled').onchange = e => {
    $('grid').classList.toggle('only-filled', e.target.checked);
    Store.updateSettings({ onlyFilled: e.target.checked });
  };

  $('grid').addEventListener('click', onGridClick);
  $('grid').addEventListener('dblclick', onGridDblClick);
  $('day-list').addEventListener('click', e => {
    const li = e.target.closest('li[data-date]');
    if (li) openForm(li.dataset.date);
  });

  $('day-form').addEventListener('submit', saveForm);
  $('f-date').addEventListener('change', onFormDateChange);
  $('f-delete').onclick = deleteFromForm;
  document.querySelectorAll('dialog [data-close]').forEach(b => {
    b.onclick = () => b.closest('dialog').close();
  });

  $('d-export').onclick = () => download(`treeniseuranta-${state.year}.json`, Store.exportYear(state.year));
  $('d-export-all').onclick = () => download(`treeniseuranta-kaikki-${todayIso()}.json`, Store.exportAll());
  $('d-copy').onclick = copyYear;
  $('d-import').onclick = () => $('d-file').click();
  $('d-file').onchange = async e => {
    const texts = await Promise.all([...e.target.files].map(f => f.text()));
    e.target.value = '';
    if (texts.length) doImport(texts);
  };
  $('d-paste').onclick = () => {
    const t = $('d-json').value.trim();
    if (t) doImport([t]);
  };
  $('s-save').onclick = saveSync;
  $('s-test').onclick = testSync;
  $('s-clear').onclick = clearSync;
  $('d-clear-year').onclick = clearYear;

  document.addEventListener('visibilitychange', () => {
    if (!Store.syncConfig()) return;
    if (document.visibilityState === 'hidden') syncAll();
    else syncYear(state.year);
  });
}

function init() {
  buildForm();
  bind();
  setYear(state.year);
  refreshRemoteYears();
}

init();
