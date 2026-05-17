# Bons spéciaux de la semaine — Joliette (Codex)

Outil hebdomadaire pour produire une liste d'épicerie claire, pratique et vérifiable pour Joliette.

Le point d'entrée humain officiel est maintenant:

- `reports/weeks/Semaine du 11 au 17 mai 2026/00 Liste d'épicerie.md`
- `reports/weeks/Semaine du 11 au 17 mai 2026/01 Choix d'items.md`
- `reports/weeks/Semaine du 11 au 17 mai 2026/02 Sélection par épicerie.md`

Le dossier hebdomadaire est aussi exporté automatiquement vers Obsidian Dropbox:

- `/Users/slugz/Library/CloudStorage/Dropbox/OTHERS/OBSIDIAN MD/Bons speciaux/Semaine du 11 au 17 mai 2026/`

Le reste du dossier `reports/` existe surtout pour l'archive, l'audit et le débogage.

## Workflow officiel

1. Collecter les circulaires de Joliette via Flipp/Wishabi
2. Ajouter les entrées manuelles de `data/current_week_prices.csv` si nécessaire
3. Comparer les prix à l'historique
4. Produire un dossier hebdomadaire propre avec:
   - une liste d'épicerie lisible
   - un résumé par magasin en lecture seule
   - les preuves et fichiers techniques associés

## Commandes

```bash
npm install
npm test
npm run weekly
npm run finalize
npm run watch-picker
npm run web
```

Validation manuelle forcée malgré le cooldown Flipp:

```bash
BONS_SPECIAUX_IGNORE_RATE_LIMIT=1 npm run weekly
```

Recherche rapide dans la semaine déjà scorée:

```bash
npm run query -- poulet beurre fraises
```

Site local:

```bash
npm run web
```

Puis ouvrir:

```text
http://localhost:4187
```

## Où regarder après un run

Exemple pour la semaine du 11 au 17 mai 2026:

- dossier principal: `reports/weeks/Semaine du 11 au 17 mai 2026/`
- fichier final: `reports/weeks/Semaine du 11 au 17 mai 2026/00 Liste d'épicerie.md`
- fichier à cocher: `reports/weeks/Semaine du 11 au 17 mai 2026/01 Choix d'items.md`
- résumé par magasin en lecture seule: `reports/weeks/Semaine du 11 au 17 mai 2026/02 Sélection par épicerie.md`
- guide local: `reports/weeks/Semaine du 11 au 17 mai 2026/Autres/README.md`
- site local: `website/index.html`
- données web: `website/data/weeks/semaine-du-11-au-17-mai-2026/week.json`

## Ce que contient le dossier hebdomadaire

Chaque dossier hebdomadaire `reports/weeks/Semaine du .../` contient:

- `00 Liste d'épicerie.md` — la liste finale automatique, regroupée par magasin; coche une case ici pour enlever un item déjà choisi
- `01 Choix d'items.md` — version principale pour ajouter ou enlever des items
- `02 Sélection par épicerie.md` — résumé par magasin en lecture seule
- `Autres/README.md` — guide local
- `Autres/full-report.md` — version complète de la semaine
- `Autres/audit.json` — piste d'audit machine-readable
- `Autres/raw-items.json` — snapshot brut des items collectés
- `Autres/verified-shortlist.json` — shortlist vérifiée
- `Autres/scored.json` — snapshot scoré complet

## Apparence Obsidian

Le run hebdomadaire installe aussi le snippet Obsidian:

- `.obsidian/snippets/bons-speciaux.css`

Les fichiers `00 Liste d'épicerie.md`, `01 Choix d'items.md` et `02 Sélection par épicerie.md` reçoivent automatiquement `cssclasses: bons-speciaux`. Si les snippets CSS sont actifs dans Obsidian, les items apparaissent comme des cartes plus propres, avec sections, preuves et détails mieux séparés. Si le snippet n'est pas actif sur un appareil, les fichiers restent du Markdown lisible.

Le format visuel attendu de `01 Choix d'items.md` est:

```md
## Sections

- [[#🥬 Fruits et légumes|🥬 Fruits et légumes]]

## 🥬 Fruits et légumes

- [ ] **Nom de l'item** — **Prix**
  - 📍 **Magasin:** Nom du magasin
  - ⚖️ **Échelle:** équivalent ou unité non confirmée, si utile
  - ✅ **Pourquoi:** raison courte
  - 📊 comparaison, si disponible
  - 📸 **Preuve du prix**
    <img ... />
```

Règles UI importantes:

- Le prix reste sur la même ligne que le nom de l'item.
- Le magasin reste juste sous l'item avec `📍 **Magasin:**`.
- Les détails secondaires restent sous l'item en sous-puces pour éviter les marqueurs Markdown brisés dans Obsidian.
- Le sommaire en haut sert de navigation rapide entre les sections.
- `00 Liste d'épicerie.md` utilise des cases vides comme action de retrait: cocher une case enlève l'item et décoche le picker.

## Site local

Le run hebdomadaire alimente aussi une petite application statique dans `website/`.

- `website/index.html` — interface locale
- `website/app.js` — logique de sélection et liste finale
- `website/styles.css` — design
- `website/data/weeks/index.json` — index des semaines disponibles
- `website/data/weeks/<semaine>/week.json` — données complètes d'une semaine

Le site ne scrape rien. Il lit seulement les fichiers JSON générés par `npm run weekly`.

Fonctionnement:

- la page d'accueil montre les semaines disponibles
- chaque semaine ouvre une interface en 3 zones: contrôles en haut, items du rayon actif au centre, panier final à droite
- la semaine se choisit avec un menu déroulant intégré en haut, sans menu natif qui recouvre les autres champs
- cliquer un rayon en haut change le contenu central sans faire sauter la page de haut en bas
- les rayons restent visibles en lignes de boutons; ne pas revenir à un rail horizontal à scroller
- la recherche en haut permet de trouver directement un item sans connaître son rayon
- les items sont présentés en cartes produit: preuve visuelle en haut, nom/prix/magasin en dessous, bouton `Ajouter`
- si aucune image n'existe, la carte garde un emplacement propre `Image non disponible` au lieu de casser la grille
- le haut de page explique les sources et la méthode: magasins utilisés, prix CAD, limite maximale par rayon et raison pour laquelle un rayon peut être court
- cocher un item l'ajoute au panier final à droite et met à jour le compteur de panier
- la liste finale est regroupée par épicerie avec adresse et prix
- `Exporter PDF` demande au serveur local de créer un PDF propre directement sur le bureau de l'utilisateur; le PDF reste volontairement simple avec magasin, adresse, item et prix seulement
- la sélection est sauvegardée dans le navigateur avec `localStorage`

Important: l'export PDF direct vers le bureau fonctionne seulement avec `npm run web`, car c'est le serveur local Node qui écrit le fichier. Un site statique hébergé ne peut pas écrire silencieusement sur le bureau d'un utilisateur; pour une version hébergée, il faudra revenir à un téléchargement navigateur ou à un service serveur.

### Mise en ligne Cloudflare Pages

Le site public peut être déployé comme site statique Cloudflare Pages. Il lit les fichiers déjà générés dans `website/data/weeks/`; il ne scrape rien en production.

Préparer les données:

```bash
npm run weekly
npm test
```

Authentifier Cloudflare sur la machine:

```bash
npm run cloudflare:login
```

Déployer:

```bash
npm run deploy:cloudflare
```

Le projet Cloudflare Pages s'appelle `bons-speciaux-joliette` et sert directement le dossier `website/`.

Déploiement vérifié:

- Production Cloudflare Pages: https://bons-speciaux-joliette.pages.dev/
- Déploiement vérifié: https://612fa3a3.bons-speciaux-joliette.pages.dev/
- Projet: `bons-speciaux-joliette`
- Dossier publié: `website/`

Important pour la version hébergée:

- la sélection d'items fonctionne dans le navigateur avec `localStorage`
- les prix et images viennent des JSON générés par le run hebdomadaire
- l'export PDF direct vers `~/Desktop` reste local seulement, via `npm run web`
- sur Cloudflare Pages statique, il faudra utiliser un téléchargement navigateur ou une fonction serveur séparée pour remplacer l'export local
- ne jamais publier `.env`, `.cache/`, `node_modules/`, `output/` ou les logs; ils sont ignorés par `.gitignore`

### Mise à jour automatique avec GitHub

Le workflow GitHub Actions `.github/workflows/weekly-cloudflare.yml` peut faire le run complet chaque semaine:

1. installer les dépendances
2. lancer `npm run weekly`
3. lancer `npm test`
4. committer les changements dans `data/`, `reports/` et `website/data/`
5. déployer `website/` sur Cloudflare Pages

Déclencheurs:

- automatique le jeudi à `12:00 UTC` environ, soit le matin à Joliette pendant l'heure avancée
- manuel avec `Actions > Weekly grocery update > Run workflow`

Secrets GitHub requis:

- `CLOUDFLARE_API_TOKEN` — token Cloudflare avec accès Pages write
- `CLOUDFLARE_ACCOUNT_ID` — `ad3eabc063a93c866a66ba7a030019a2`
- `FIRECRAWL_API_KEY` — optionnel, seulement si les adaptateurs Firecrawl sont réactivés

État actuel:

- Cloudflare est connecté localement avec `officialsnails@gmail.com`
- Le site live est `https://bons-speciaux-joliette.pages.dev/`
- Ce dossier local n'est pas encore relié à un repo GitHub remote; il faut le publier avec GitHub Desktop ou un remote Git avant que l'automatisation GitHub Actions fonctionne.

### Validation du site

Après un changement au site, au format des données web ou au rendu de la liste, il faut tester dans un vrai navigateur.

Commande:

```bash
npm run web
```

Puis ouvrir:

```text
http://localhost:4187
```

Checklist minimum:

- la page charge sans erreur
- une carte de semaine apparaît
- ouvrir la semaine affiche les contrôles en haut, les items au centre et le panier à droite
- cliquer un rayon change le rayon actif sans scroll violent
- tous les rayons restent visibles sans scroll horizontal
- la recherche trouve un item à travers tous les rayons
- choisir une épicerie dans `Voir par épicerie` affiche tous les bons prix de ce magasin, tous rayons confondus
- cliquer ensuite un rayon remet la vue par rayon et vide le filtre épicerie
- les cartes produit gardent une image ou un placeholder propre
- cocher un item l'ajoute au panier final à droite et au compteur de panier
- décocher ou vider la sélection retire l'item
- `Exporter PDF` crée un PDF sur `~/Desktop`
- les photos de preuve, prix, unités et magasins restent lisibles

Quand disponible, utiliser Agent Browser ou Playwright pour cette validation. Pour Playwright, prendre un snapshot avant les clics, utiliser les références d'éléments du snapshot, puis capturer une image dans `output/playwright/` si un artefact visuel aide à vérifier le rendu.

## Règles de confiance

- Tous les prix sont en dollars canadiens
- Les items Flipp affichent maintenant une preuve visuelle intégrée quand disponible
- Les preuves photo des items retenus restent visibles directement dans le Markdown
- Les prix affichent l'unité quand elle est connue (`/lb`, `/kg`, `/L`, etc.)
- Les items au poids avec prix en livre affichent aussi l'équivalent au kg quand disponible
- Les preuves photo sont aussi passées dans un OCR local conservateur quand `tesseract` est disponible. Le système peut alors récupérer des formats évidents comme `/100g`, `/lb` ou `/kg` même si l'API Flipp ne les donne pas.
- Si l'unité n'est pas confirmée, la liste affiche seulement `Format à vérifier sur la photo.` quand une preuve existe, ou `Format non confirmé.` sans preuve photo.
- Les raisons génériques comme `Premier aperçu retenu` et `Bon prix si tu en as besoin` sont masquées dans les sorties visibles. Garder seulement les raisons utiles: économies historiques, pourcentages, comparaison gagnante ou autre explication concrète.
- Chaque rayon peut afficher jusqu'à 20 items, mais seulement si les prix sont réels, vérifiables, alimentaires, utiles et non redondants. Une section courte veut dire qu'il n'y avait pas assez de bons prix solides cette semaine.
- La classification doit privilégier l'usage réel de l'épicerie: céleri va dans `Fruits et légumes`; poisson pané et viandes froides vont dans `Viandes et poissons`; pizza va dans `Surgelés`, même si le nom contient tomate; bologne/bologna, pepperoni, chorizo, rosette, sauciflard, salami, mortadelle et prosciutto vont dans `Viandes et poissons`, même si la source les classe vaguement en épicerie.
- La déduplication doit garder le meilleur représentant d'une même famille évidente, par exemple bologne, sauciflard/chorizo ou boeuf haché extra maigre. Les rosettes de boeuf ne doivent pas être confondues avec le sauciflard/chorizo.
- Les entrées manuelles sans image affichent explicitement:
  - `⚠️ Preuve photo manquante (entrée manuelle)`
- Un prix n'est pas montré comme "confirmé visuellement" s'il ne l'est pas
- Un run CSV-only ou mock-only ne doit jamais écraser un bon run live

## Sources

### Source principale

- Flipp / Wishabi pour Metro, Maxi, IGA, Super C, BoniChoix Joliette, Inter-Marché et Marchés Tradition

### Source secondaire

- `data/current_week_prices.csv` pour les entrées manuelles

### Source de secours

- Adaptateurs Firecrawl présents, mais désactivés par défaut

## État actuel

Ce fork Codex est le workspace de confiance.

Le pipeline est prêt pour un nouveau run dans une nouvelle fenêtre:

- `npm test` doit passer
- `npm run weekly` doit produire un nouveau dossier `reports/weeks/Semaine du .../`
- `npm run weekly` doit aussi exporter ce dossier vers Dropbox Obsidian
- `npm run weekly` doit aussi mettre à jour `website/data/weeks/index.json` et `website/data/weeks/<semaine>/week.json`
- après un changement UI web, `npm run web` doit être validé dans un vrai navigateur avec Agent Browser ou Playwright quand disponible
- la synchronisation auto doit démarrer pour que cocher une case dans `01 Choix d'items.md` ajoute à `00 Liste d'épicerie.md`
- cocher une case dans `00 Liste d'épicerie.md` doit enlever l'item de `01 Choix d'items.md`
- le fichier à lire en premier dans Obsidian est `00 Liste d'épicerie.md`

## Structure utile

```text
data/
  current_week_prices.csv
  historical_prices.csv
  last-week-scored.json
  products.json
  source_status.json
  stores.json

reports/
  weeks/
    Semaine du 11 au 17 mai 2026/
      00 Liste d'épicerie.md
      01 Choix d'items.md
      02 Sélection par épicerie.md
      Autres/
        README.md
        full-report.md
        audit.json
        raw-items.json
        verified-shortlist.json
        scored.json
        picker-items.json

sources/
  flipp-adapter.ts
  firecrawl-adapter.ts
  csv-adapter.ts

src/
  collect-current-deals.ts
  generate-report.ts
  query-deals.ts
  run-weekly.ts
  serve-website.ts
  update-history.ts

website/
  index.html
  app.js
  styles.css
  data/weeks/
    index.json
```

## Legacy reports

Ces dossiers restent présents pour compatibilité ou audit:

- `reports/mom-list/`
- `reports/verified/`
- `reports/compare/`
- `reports/raw/`
- `reports/audit/`
- `reports/scored/`
- `reports/historical-item/`

Mais ils ne sont plus le point d'entrée humain principal.
