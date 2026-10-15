# Treeniseuranta

Excel-tyylinen vuosinäkymä harjoitusten kirjaamiseen: päiväkohtainen taulukko (samat sarakkeet kuin `YYYY Harjoitukset` -välilehdellä), kuukausiyhteenveto ja kaavio. Staattinen sivu (`index.html`, `app.js`, `storage.js`, `style.css`), joka toimii GitHub Pagesissa tai paikallisesti.

Tiedot eivät ole tässä julkisessa repossa. Ne tallentuvat selaimen localStorageen ja valinnaisesti erilliseen **yksityiseen** GitHub-repoon (`data/<vuosi>.json`).

## Käyttö

- **Työpöytä (leveä ikkuna):** klikkaa solua ja kirjoita. Enter tallentaa ja siirtyy alas, Tab oikealle, Shift+Tab vasemmalle, Esc peruu. Muistiinpanoissa Shift+Enter = rivinvaihto. Sairaspäivä vaihtuu klikkaamalla. Tuplaklikkaa päivämäärää avataksesi lomakkeen.
- **Mobiili:** lista merkityistä päivistä; napauta päivää tai *Lisää merkintä* avataksesi lomakkeen.
- **Sali:** *Ohjelma*-kenttään kirjoitetaan nykyinen saliohjelma vapaana tekstinä (yksi liike per rivi). Salilla *Kopioi ohjelma* (tai *Kopioi edellinen*) täyttää *Treeni*-kentän, jota muokataan tehdyn mukaan. *Kirjaa* tallentaa tekstin valitun päivän *Lihaskunto, muistiinpanot* -sarakkeeseen ja keston *Lihaskunto [h]* -sarakkeeseen (tyhjä kesto = aika ensimmäisestä muokkauksesta). Keskeneräinen treeni säilyy laitteella, vaikka sovellus suljettaisiin. Ohjelma synkronoidaan data-repoon tiedostoon `data/saliohjelma.txt`.
- Tunnit muodossa `1:30`, `1.30` tai `1` (= 1:00). Kilometrit desimaaleina, pilkku tai piste käy.

## 1. GitHub Pages (julkinen sovellus)

1. Pushaa tämä repo GitHubiin (julkinen).
2. *Settings → Pages → Build and deployment → Deploy from a branch*, haara `main`, kansio `/ (root)`.
3. Sovellus löytyy osoitteesta `https://<käyttäjä>.github.io/Treeniseuranta/`.

## 2. Yksityinen data-repo

1. Luo uusi **private**-repo, esim. `treeniseuranta-data`, ja valitse *Add a README file* (repo ei saa olla tyhjä, jotta `main`-haara on olemassa).
2. `data/`-kansiota ei tarvitse luoda, sovellus luo tiedostot itse.

## 3. Token

1. GitHub: *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*.
2. *Repository access*: **Only select repositories** → `treeniseuranta-data`.
3. *Permissions → Repository permissions → Contents*: **Read and write**.
4. Vanhenemisaika enintään vuosi; kun token vanhenee, sovellus näyttää virheen ja uusi token syötetään *Data*-ikkunaan.

Token tallentuu vain kyseisen laitteen selaimeen. Sillä on pääsy ainoastaan data-repoon.

## 4. Ensimmäinen tuonti (Mac)

```sh
pip3 install openpyxl
python3 convert_xlsx.py            # tai: python3 convert_xlsx.py polku/tiedostoon.xlsx
```

Skripti kirjoittaa `export/<vuosi>.json` jokaiselle välilehdelle ja tulostaa vuosisummat tarkistusta varten.

1. Avaa sovellus, *Data → Tuo tiedosto(t)* ja valitse kaikki `export/*.json` kerralla.
2. Syötä *GitHub-synkronointi*-kohtaan omistaja, repo, haara (`main`) ja token. *Testaa yhteys* → *Tallenna asetukset*. Kaikki vuodet pushataan data-repoon.

## 5. iPhone

1. Avaa sovelluksen osoite Safarissa, *Data* → syötä samat synkronointiasetukset → *Tallenna asetukset*. Tiedot haetaan automaattisesti.
2. *Jaa → Lisää Koti-valikkoon*.

Muutokset pushataan noin 3 s viiveellä ja kun sovellus siirtyy taustalle. Kun sovellus palaa näkyviin, valitun vuoden tiedot haetaan uudelleen.

## Ilman synkronointia

*Data*-ikkunasta voi viedä vuoden tai kaikki vuodet JSON-tiedostoon, kopioida vuoden JSONin leikepöydälle ja liittää JSONia (esim. tekoälyn muokkaamana) takaisin. *Yhdistä* korvaa vain ne päivät, jotka ovat tuotavassa datassa; *Korvaa koko vuosi* korvaa vuoden kokonaan.

## Datamuoto

```json
{
  "version": 2,
  "year": 2026,
  "days": {
    "2026-01-08": { "gymH": "1:00", "gymNotes": "5x5x60kg takakyykky" },
    "2026-05-20": { "aerobicH": "0:30", "cycleKm": 5.55 }
  }
}
```

Kentät: `sick` (true), `compCal`, `arrows`, `competition`, `round1`, `round2`, `result`, `distanceM`, `notes`, `aerobicH`, `swimKm`, `runKm`, `walkKm`, `cycleKm`, `skiKm`, `aerobicNotes`, `careH`, `careNotes`, `gymH`, `gymNotes`, `climbH`, `climbNotes`. Tunnit merkkijonona `"H:MM"`, matkat numeroina. Vain täytetyt kentät tallennetaan.

## Paikallinen kehitys

```sh
python3 -m http.server 8000
# http://localhost:8000/
```
