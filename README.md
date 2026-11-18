# Blockchain Fundamentals · Laboratorët

## Nisja në VS Code

1. Instalo Node.js LTS nëse nuk është instaluar.
2. Hape këtë dosje në VS Code.
3. Hape terminalin e VS Code dhe ekzekuto `npm start`.
4. Hape adresën `http://127.0.0.1:4173` në shfletues.

Nuk ka paketa shtesë për instalim. Të dhënat ruhen te `data/students.json`. Kopjen e databazës e shkarkon ligjëruesi nga paneli /admin.

## Profilet e provës

Janë shtuar dy profile bosh për demonstrim: `demo1` (Arta Shembull) dhe `demo2` (Dion Shembull). Përdor emrin, mbiemrin dhe pseudonimin e një profili ekzistues për ta hapur progresin e tij, ose krijo pseudonim të ri.

## E rëndësishme për përdorim në klasë

Ky është prototip lokal pa autentikim. Pseudonimet nuk janë fjalëkalim; kush ka qasje te kompjuteri/serveri mund të shohë ose ndryshojë progresin. Përdore për demonstrim ose në një kompjuter të kontrolluar. Mos e ekspozo në internet dhe mos ruaj seed phrase, fjalëkalime apo të dhëna sensitive në të. Për përdorim real nga studentë të ndryshëm nevojiten autentikim dhe databazë e hostuar me kontroll qasjeje.

## Paneli i ligjëruesit

Kur nis `npm start`, terminali shfaq një **token admin** të ri (ose vendose vetë: `ADMIN_TOKEN=fjala npm start`). Hape `http://127.0.0.1:4173/admin`, shkruaj tokenin dhe do të shohësh studentët, XP, seancat e përfunduara dhe hapat e kaluar (ata që kanë ngecur). Nga aty mund të hapësh një seancë për një student (ai e merr brenda 15 sekondash), të shkarkosh JSON ose të fshish një profil.

## Çka mbron serveri

- Shërben vetëm `index.html` dhe `admin.html`; `data/`, `server.js` dhe `.git` nuk janë të aksesueshme.
- Progresi pranohet vetëm në formën e njohur: XP nuk mund të fryhet dhe seanca nuk shënohet e përfunduar pa të gjithë hapat. Hapat vazhdojnë të jenë të vetë-raportuar nga studenti.
- Hapat e kaluar (“Kam problem · kalo”) nuk japin XP dhe i shfaqen ligjëruesit.
- Çdo profil ka PIN me 4 shifra (ruhet i hash-uar; 5 provime të gabuara bllokojnë hyrjen për 1 minutë). Profilet e vjetra pa PIN e vendosin atë në hyrjen e parë. Nëse studenti harron PIN-in, përdor “Reset PIN” te /admin.
- Te /admin mund të shtosh pyetje shtesë për çdo seancë; studentët i shohin pasi ta përfundojnë seancën (+1 XP për pyetje).
- Përdore në rrjet të kontrolluar dhe fshiji profilet pas kursit.

## Struktura

- `index.html`, `style.css`: faqja e studentëve
- `admin/`: paneli i ligjëruesit (`/admin`)
- `server.js`: serveri; shërben vetëm skedarët e listuar te `FILES`
- `data/`: databaza lokale (`students.json`, `questions.json`). **Nuk futet kurrë në Git** (shih `.gitignore`).
