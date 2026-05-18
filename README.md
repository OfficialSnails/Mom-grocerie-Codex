# Bons spéciaux de la semaine — Joliette (Codex)

Outil hebdomadaire pour produire une liste d'épicerie claire, pratique et vérifiable pour Joliette.

Le point d'entrée humain officiel côté Markdown est maintenant:

- `reports/weeks/Semaine du 14 au 20 mai 2026/00 Liste d'épicerie.md`
- `reports/weeks/Semaine du 14 au 20 mai 2026/01 Choix d'items.md`
- `reports/weeks/Semaine du 14 au 20 mai 2026/02 Sélection par épicerie.md`

Le dossier hebdomadaire est aussi exporté automatiquement vers Obsidian Dropbox:

- `/Users/slugz/Library/CloudStorage/Dropbox/OTHERS/OBSIDIAN MD/Bons speciaux/Semaine du 14 au 20 mai 2026/`

Le reste du dossier `reports/` existe surtout pour l'archive, l'audit et le débogage.

## Workflow officiel

1. Collecter les circulaires de Joliette via Flipp/Wishabi
2. Ajouter les entrées manuelles de `data/current_week_prices.csv` si nécessaire
3. Comparer les prix à l'historique
4. Produire un dossier hebdomadaire propre avec:
   - une liste d'épicerie lisible
   - un résumé par magasin en lecture seule
   - les preuves et fichiers techniques associés
5. Mettre à jour le site statique avec deux modes:
   - `Bons prix` pour les vrais rabais utiles, mode par défaut
   - `Tous les produits` pour chercher les produits trouvés dans les circulaires sans les présenter comme des rabais

Les semaines suivent le cycle réel des circulaires du jeudi au mercredi, par exemple `14 au 20 mai 2026`, puis `21 au 27 mai 2026`.

## Commandes

```bash
npm install
npm test
npm run weekly
npm run finalize
npm run watch-picker
npm run web
npm run qa:pantry
npm run qa:categories
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

Exemple pour la semaine du 14 au 20 mai 2026:

- dossier principal: `reports/weeks/Semaine du 14 au 20 mai 2026/`
- fichier final: `reports/weeks/Semaine du 14 au 20 mai 2026/00 Liste d'épicerie.md`
- fichier à cocher: `reports/weeks/Semaine du 14 au 20 mai 2026/01 Choix d'items.md`
- résumé par magasin en lecture seule: `reports/weeks/Semaine du 14 au 20 mai 2026/02 Sélection par épicerie.md`
- guide local: `reports/weeks/Semaine du 14 au 20 mai 2026/Autres/README.md`
- site local: `website/index.html`
- données web: `website/data/weeks/semaine-du-14-au-20-mai-2026/week.json`

## Ce que contient le dossier hebdomadaire

Chaque dossier hebdomadaire `reports/weeks/Semaine du .../` contient:

- `00 Liste d'épicerie.md` — la liste finale automatique, regroupée par magasin; coche une case ici pour enlever un produit déjà choisi
- `01 Choix d'items.md` — version principale pour ajouter ou enlever des produits
- `02 Sélection par épicerie.md` — résumé par magasin en lecture seule
- `Autres/README.md` — guide local
- `Autres/full-report.md` — version complète de la semaine
- `Autres/audit.json` — piste d'audit machine-readable
- `Autres/raw-items.json` — snapshot brut des produits collectés
- `Autres/verified-shortlist.json` — shortlist vérifiée
- `Autres/scored.json` — snapshot scoré complet

## Apparence Obsidian

Le run hebdomadaire installe aussi le snippet Obsidian:

- `.obsidian/snippets/bons-speciaux.css`

Les fichiers `00 Liste d'épicerie.md`, `01 Choix d'items.md` et `02 Sélection par épicerie.md` reçoivent automatiquement `cssclasses: bons-speciaux`. Si les snippets CSS sont actifs dans Obsidian, les produits apparaissent comme des cartes plus propres, avec sections, preuves et détails mieux séparés. Si le snippet n'est pas actif sur un appareil, les fichiers restent du Markdown lisible.

Le format visuel attendu de `01 Choix d'items.md` est:

```md
## Sections

- [[#🥬 Fruits et légumes|🥬 Fruits et légumes]]

## 🥬 Fruits et légumes

- [ ] **Nom du produit** — **Prix**
  - 📍 **Magasin:** Nom du magasin
  - ⚖️ **Échelle:** équivalent ou unité non confirmée, si utile
  - ✅ **Pourquoi:** raison courte
  - 📊 comparaison, si disponible
  - 📸 **Preuve du prix**
    <img ... />
```

Règles UI importantes:

- Le prix reste sur la même ligne que le nom du produit.
- Le magasin reste juste sous le produit avec `📍 **Magasin:**`.
- Les détails secondaires restent sous le produit en sous-puces pour éviter les marqueurs Markdown brisés dans Obsidian.
- Le sommaire en haut sert de navigation rapide entre les sections.
- `00 Liste d'épicerie.md` utilise des cases vides comme action de retrait: cocher une case enlève le produit et décoche le picker.

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
- chaque semaine ouvre une interface en 3 zones: contrôles en haut, produits du rayon actif au centre, panier final à droite
- le mode `Bons prix` est le mode par défaut et ne montre que les rabais retenus
- le mode `Tous les produits` permet de chercher ou parcourir les produits trouvés dans les circulaires générées, avec le badge `Produit trouvé` quand ce n'est pas un vrai bon prix
- le rayon `Tous` est une option virtuelle du site, pas une vraie catégorie dans les données; il affiche tous les produits du mode courant et de l'épicerie sélectionnée
- la semaine se choisit avec un menu déroulant intégré en haut, sans menu natif qui recouvre les autres champs
- cliquer un rayon en haut change le contenu central sans faire sauter la page de haut en bas
- les rayons restent visibles en lignes de boutons; ne pas revenir à un rail horizontal à scroller, et ne pas couper les mots en plein milieu dans les cartes
- choisir une épicerie garde ce magasin actif quand on clique un rayon; les compteurs des rayons doivent alors être calculés pour ce magasin et le mode courant
- les compteurs sur les cartes de rayons montrent seulement les produits disponibles, par exemple `Tous 1347`; ne pas afficher de ratio `sélectionnés/total` comme `13/1347`
- la recherche en haut ignore le rayon actif pour trouver directement un produit dans toutes les catégories; elle respecte quand même le filtre épicerie si une épicerie est choisie
- les produits sont présentés en cartes produit: preuve visuelle en haut, nom/prix/magasin en dessous, bouton `Ajouter`
- si aucune image n'existe, la carte garde un emplacement propre `Image non disponible` au lieu de casser la grille
- le haut de page explique les sources et la méthode: magasins utilisés, prix CAD, limite maximale par rayon et raison pour laquelle un rayon peut être court
- ajouter un produit l'envoie au panier final à droite et met à jour le compteur de panier
- la liste finale est regroupée par épicerie avec adresse et prix
- la zone `Notes` du panier est sauvegardée localement et apparaît dans le PDF sous `Notes`
- la liste finale affiche aussi un `Total estimé` conservateur: les prix fixes comptent dans le sous-total, mais les prix au poids ou formats variables restent indiqués à vérifier
- `Exporter PDF` crée une liste propre avec magasin, adresse, produit, prix, notes, `Total estimé` en haut, sous-totaux par magasin et `Total estimé de la liste` à la fin. En local (`npm run web`), le PDF est sauvegardé directement sur le bureau. Sur le site hébergé, le navigateur télécharge un vrai fichier PDF que la personne peut imprimer ou envoyer.
- la sélection est sauvegardée dans le navigateur avec `localStorage`

Important: un site hébergé ne peut pas écrire silencieusement sur le bureau d'un utilisateur. Le site public génère donc un PDF téléchargeable dans le navigateur; l'utilisateur choisit ensuite où le sauvegarder, l'imprime ou l'envoie à son téléphone.

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

- la sélection de produits fonctionne dans le navigateur avec `localStorage`
- les prix et images viennent des JSON générés par le run hebdomadaire
- l'export PDF direct vers `~/Desktop` reste local seulement, via `npm run web`
- sur Cloudflare Pages statique, le bouton génère un PDF téléchargeable côté navigateur, compatible Windows/Mac sans serveur local
- ne jamais publier `.env`, `.cache/`, `node_modules/`, `output/` ou les logs; ils sont ignorés par `.gitignore`

### Mise à jour automatique avec GitHub

Le workflow GitHub Actions `.github/workflows/weekly-cloudflare.yml` garde Cloudflare à jour à partir de GitHub:

- à chaque push sur `main`, il installe les dépendances, lance `npm test`, puis déploie `website/` sur Cloudflare Pages
- chaque jeudi, il peut aussi lancer `npm run weekly`, committer les nouveaux fichiers de semaine, tester, puis déployer

Déclencheurs:

- automatique sur chaque push vers `main`
- automatique le jeudi à `12:00 UTC` environ, soit le matin à Joliette pendant l'heure avancée
- manuel avec `Actions > Weekly grocery update > Run workflow`

Secrets GitHub requis:

- `CLOUDFLARE_API_TOKEN` — token Cloudflare avec accès Pages write
- `CLOUDFLARE_ACCOUNT_ID` — `ad3eabc063a93c866a66ba7a030019a2`
- `FIRECRAWL_API_KEY` — optionnel, seulement si les adaptateurs Firecrawl sont réactivés

État actuel:

- Cloudflare est connecté localement avec `officialsnails@gmail.com`
- Le site live est `https://bons-speciaux-joliette.pages.dev/`
- Le projet Cloudflare Pages actuel est un projet Direct Upload. Il ne se connecte pas directement comme projet Git Cloudflare, mais GitHub Actions déploie vers le même projet Cloudflare avec Wrangler. C'est le chemin à garder pour conserver l'URL actuelle.
- Ce dossier local pointe vers `https://github.com/OfficialSnails/Mom-grocerie-Codex.git`; il faut pousser avec GitHub Desktop et ajouter les secrets GitHub avant que l'automatisation fonctionne côté GitHub.

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
- ouvrir la semaine affiche les contrôles en haut, les produits au centre et le panier à droite
- cliquer un rayon change le rayon actif sans scroll violent
- tous les rayons restent visibles sans scroll horizontal
- les cartes de rayons gardent des libellés lisibles: pas de coupure comme `Boulangeri/e`, pas de collision entre le libellé et le compteur
- la recherche trouve un produit à travers tous les rayons
- `Épiceries` est un filtre à cases compact: `Épiceries régulières` sélectionne les magasins courants, `Tout inclure` ajoute aussi Costco, et `Tout décocher` vide volontairement la sélection
- si aucune épicerie n'est cochée, afficher `Choisis au moins une épicerie pour voir les produits.` au lieu de réactiver automatiquement des magasins
- Costco est disponible mais non coché par défaut, parce que ses formats/membres/en vrac ne conviennent pas à toutes les courses
- cliquer ensuite un rayon garde les épiceries sélectionnées et filtre seulement ce rayon pour ces épiceries
- chercher un mot comme `baguette` trouve le produit même si le rayon actif est `Fruits et légumes`
- changer entre `Bons prix` et `Tous les produits` conserve la sélection finale
- les cartes produit gardent une image ou un placeholder propre
- le rayon `Tous` apparaît en premier et montre le total du mode/magasin courant
- les autres rayons montrent aussi uniquement le total disponible pour le mode/magasin courant, pas un ratio avec les produits sélectionnés
- cocher un produit l'ajoute au panier final à droite et au compteur de panier
- le panier affiche `Total estimé`; les produits au poids ou au format variable sont comptés dans une note séparée plutôt qu'ajoutés au sous-total
- décocher ou vider la sélection retire le produit
- écrire une note dans le panier, recharger la page, et vérifier que la note reste là
- `Exporter PDF` crée un PDF sur `~/Desktop` en local, ou télécharge un PDF depuis le site hébergé; vérifier que le PDF contient le `Total estimé` en haut, les sous-totaux par magasin et le `Total estimé de la liste` à la fin
- les photos de preuve, prix, unités et magasins restent lisibles

Quand disponible, utiliser Agent Browser ou Playwright pour cette validation. Pour Playwright, prendre un snapshot avant les clics, utiliser les références d'éléments du snapshot, puis capturer une image dans `output/playwright/` si un artefact visuel aide à vérifier le rendu.

## Règles de confiance

- Tous les prix sont en dollars canadiens
- Le `Total estimé` du site et du PDF est volontairement conservateur: il additionne seulement les prix fixes/emballages. Les prix `/kg`, `/lb`, `/100g`, `/L` ou formats incertains ne sont pas additionnés sans quantité réelle; ils restent affichés dans la liste avec une note de vérification. Le PDF doit répéter ce total en haut et comme `Total estimé de la liste` à la fin, après les sous-totaux par magasin.
- Les fichiers hebdomadaires du site doivent conserver `currentPrice`, `price` et `unit` pour chaque produit. Le total est calculé dans le panier et au moment de l'export PDF, pas pendant le scrape.
- Les produits Flipp affichent maintenant une preuve visuelle intégrée quand disponible
- Les preuves photo des produits retenus restent visibles directement dans le Markdown
- Les prix affichent l'unité quand elle est connue (`/lb`, `/kg`, `/L`, etc.)
- Les produits au poids avec prix en livre affichent aussi l'équivalent au kg quand disponible
- Les preuves photo sont aussi passées dans un OCR local conservateur quand `tesseract` est disponible. Le système peut alors récupérer des formats évidents comme `/100g`, `/lb` ou `/kg` même si l'API Flipp ne les donne pas.
- Si l'unité n'est pas confirmée, la liste affiche seulement `Format à vérifier sur la photo.` quand une preuve existe, ou `Format non confirmé.` sans preuve photo.
- Les raisons génériques comme `Premier aperçu retenu` et `Bon prix si tu en as besoin` sont masquées dans les sorties visibles. Garder seulement les raisons utiles: économies historiques, pourcentages, comparaison gagnante ou autre explication concrète.
- Chaque rayon peut afficher jusqu'à 20 bons prix, mais seulement si les prix sont réels, vérifiables, utiles et non redondants. Une section courte veut dire qu'il n'y avait pas assez de bons prix solides cette semaine.
- Le mode `Tous les produits` peut afficher plus large, mais ces produits doivent rester marqués `Produit trouvé` et ne doivent pas être présentés comme des rabais.
- Le mode `Tous les produits` doit dédupliquer les variantes évidentes d'une même tuile de circulaire: même magasin, même prix et titre quasi identique. L'image identique aide, mais certaines tuiles Flipp/Wishabi ont des URLs différentes; la similarité du titre doit rester forte. Garder la version la plus descriptive, sans fusionner deux magasins, deux prix ou deux produits différents.
- Costco est inclus via Flipp/Wishabi quand la circulaire chevauche la semaine générée. Les produits Costco sont exclus du filtre par défaut, mais apparaissent avec `Tout inclure` ou la case Costco. Les offres peuvent rester valides plusieurs semaines; elles peuvent donc réapparaître dans des snapshots hebdomadaires différents, mais doivent être dédupliquées à l'intérieur d'une même semaine. Comme Costco mélange beaucoup d'offres non alimentaires, le site filtre Costco aux produits utiles pour l'épicerie: nourriture, boissons, surgelés, maison consommable, hygiène, pharmacie, animaux et consommables de cuisine; vêtements, meubles, électronique, ventilateurs, outils, déco et autres produits non consommables sont exclus de l'expérience shopper.
- Les noms visibles des magasins doivent rester génériques Québec (`IGA`, `Maxi`, `Metro`, `Super C`, `Familiprix`, `Costco`) même si le code postal de Joliette sert d'ancrage pour obtenir les circulaires du Québec.
- `BoniChoix St-Émilie` doit être regroupé sous `BoniChoix` dans l'app shopper, les comptes, le panier final et le PDF. Conserver l'identifiant source brut seulement pour l'audit/historique si nécessaire.
- La classification doit privilégier l'usage réel de l'épicerie: céleri, kiwi, raisins, ail, ananas et avocat vont dans `Fruits et légumes`; goberge/crabe/pollock/surimi, creton, beefsteak, poisson pané et viandes froides vont dans `Viandes et poissons`; pizza et repas congelés vont dans `Surgelés`; pilules, médicaments et vitamines vont dans `Santé et pharmacie`; bologne/bologna, pepperoni, chorizo, rosette, sauciflard, salami, mortadelle et prosciutto vont dans `Viandes et poissons`, même si la source les classe vaguement en épicerie.
- `Maison et entretien` regroupe les essentiels non alimentaires utiles: détergent, lessive, savon à vaisselle, produits nettoyants, papier hygiénique, papier essuie-tout, Kleenex/mouchoirs, Q-tips/coton-tiges, shampoing, savon, antisudorifique, couches et hygiène de base.
- `Garde-manger et autres` est le libellé visible du fallback pantry; l'identifiant interne peut rester `pantry` pour compatibilité.
- `Garde-manger et autres` est le fallback seulement après les règles fortes: viandes/poissons, fruits/légumes, surgelés, boulangerie, produits laitiers/oeufs, maison/entretien, santé/pharmacie et collations/boissons.
- Les produits préparés dont le coeur est clairement fruit/légume restent dans `Fruits et légumes`, même si la source les place en épicerie: barquette de légumes, plateau de crudités, plateau de fruits, carrousel de fruits/légumes, maïs en épi et maïs sucré.
- Les faux positifs restent exclus de `Fruits et légumes`: sauce tomate, pâte de tomate, ketchup, salsa, beurre à l'ail, maïs à éclater, maïs soufflé, collations aux fruits, tartinades de fruits, tartelettes aux fruits et craquelins aux légumes.
- Pour une passe QA de classification, ne pas relancer un scrape. Corriger le classifieur réutilisable, lancer `npm test -- tests/report-generation.test.ts`, puis `npm run qa:pantry` et `npm run qa:categories`. Si les fichiers du site sont stale, régénérer seulement depuis le JSON brut existant.
- `npm run qa:pantry` est le contrôle ciblé du fallback `Garde-manger et autres`.
- `npm run qa:categories` scanne toutes les catégories, échoue seulement sur les erreurs évidentes à haute confiance, et écrit un rapport dans `reports/qa/category-review-<semaine>.md`; les cas ambigus servent de revue humaine et ne bloquent pas.
- Après une génération hebdomadaire depuis les données brutes, lancer `npm run qa:categories` avant de publier. Les corrections doivent aller dans `src/generate-report.ts`, jamais dans le JSON généré à la main.
- Pour une modification UI seulement, utiliser la boucle rapide: tests ciblés, `node --check website/app.js`, puis un smoke visuel court. Ne pas lancer `qa:pantry`, `qa:categories`, Firecrawl ou une génération longue sauf si le changement touche les sources, le classifieur, les exports hebdomadaires ou les données.
- Agent Browser ou Playwright peut être utilisé après les scans de données pour vérifier visuellement quelques rayons, mais la source principale de QA reste le scan JSON.
- La déduplication doit garder le meilleur représentant d'une même famille évidente, par exemple bologne, sauciflard/chorizo ou boeuf haché extra maigre. Les rosettes de boeuf ne doivent pas être confondues avec le sauciflard/chorizo.
- Les entrées manuelles sans image affichent explicitement:
  - `⚠️ Preuve photo manquante (entrée manuelle)`
- Un prix n'est pas montré comme "confirmé visuellement" s'il ne l'est pas
- Un run CSV-only ou mock-only ne doit jamais écraser un bon run live

## Sources

### Source principale

- Flipp / Wishabi pour Metro, Maxi, IGA, Super C, BoniChoix, Inter-Marché, Marchés Tradition, Familiprix et Costco. Le code postal Joliette reste l'ancrage Québec; Costco peut avoir des prix membre, des formats en vrac et des périodes de circulaire plus longues.

### Source secondaire

- `data/current_week_prices.csv` pour les entrées manuelles

### Source de secours

- Adaptateurs Firecrawl présents pour investigation ponctuelle. Familiprix a été vérifié avec Firecrawl, mais les produits détaillés viennent de Flipp/Wishabi parce que la page publique Familiprix ne donne pas un flux de produits suffisamment fiable.

## État actuel

Ce fork Codex est le workspace de confiance.

Le pipeline est prêt pour un nouveau run dans une nouvelle fenêtre:

- `npm test` doit passer
- `npm run weekly` doit produire un nouveau dossier `reports/weeks/Semaine du .../`
- `npm run weekly` doit aussi exporter ce dossier vers Dropbox Obsidian
- `npm run weekly` doit aussi mettre à jour `website/data/weeks/index.json` et `website/data/weeks/<semaine>/week.json`
- après un changement UI web, `npm run web` doit être validé dans un vrai navigateur avec Agent Browser ou Playwright quand disponible
- la synchronisation auto doit démarrer pour que cocher une case dans `01 Choix d'items.md` ajoute à `00 Liste d'épicerie.md`
- cocher une case dans `00 Liste d'épicerie.md` doit enlever le produit de `01 Choix d'items.md`
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
    Semaine du 14 au 20 mai 2026/
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
