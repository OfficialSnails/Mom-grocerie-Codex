# Reports

Point d'entrée humain:

- `weeks/Semaine du .../00 Liste d'épicerie.md`
- `weeks/Semaine du .../01 Choix d'items.md`
- `weeks/Semaine du .../02 Sélection par épicerie.md`

## À quoi servent les autres dossiers

- `weeks/` — sortie officielle à lire
- `weeks/Semaine du .../01 Choix d'items.md` — sélection principale à cocher
- `weeks/Semaine du .../02 Sélection par épicerie.md` — résumé par magasin en lecture seule
- `weeks/Semaine du .../00 Liste d'épicerie.md` — sortie sélectionnée regroupée par magasin; coche une case ici pour enlever un item
- `weeks/Semaine du .../Autres/` — fichiers techniques, audit et procédure
- les fichiers humains utilisent `cssclasses: bons-speciaux` pour le snippet Obsidian premium
- le picker affiche `- [ ] **Item** — **Prix**`, puis le magasin/raison/comparaison sous l'item
- quand `tesseract` est disponible, les preuves photo sont lues par OCR de manière conservatrice pour récupérer les formats évidents (`/100g`, `/lb`, `/kg`) absents des données structurées Flipp
- si le format reste inconnu, afficher `Format à vérifier sur la photo.` quand il y a une preuve visuelle, ou `Format non confirmé.` sans image
- ne pas mettre les items à cocher dans des callouts ou du HTML repliable; Obsidian affiche mal les marqueurs Markdown dans ce cas
- le picker utilise plutôt un sommaire de sections en haut, puis des sections Markdown normales
- le résumé par magasin reste une référence en lecture seule; les cases interactives vivent dans `01 Choix d'items.md` et `00 Liste d'épicerie.md`
- `00 Liste d'épicerie.md` utilise une case vide comme bouton de retrait: cocher l'item ici le décoche dans le picker et le retire de la liste finale
- `historical-item/` — archive Markdown complète
- `mom-list/` — ancien format par magasin
- `verified/` — shortlist vérifiée intermédiaire
- `compare/` — comparaison entre anciennes et nouvelles sorties
- `audit/` — audit JSON
- `raw/` — snapshot brut
- `scored/` — snapshot scoré

Le site local est alimenté séparément dans `../website/data/weeks/`.
Il lit les JSON générés par le pipeline; il ne scrape rien directement. Le site doit rester une interface en 3 zones: semaine/recherche/rayons en haut, items du rayon actif au centre, panier final à droite. Le filtre `Voir par épicerie` doit permettre d'afficher tous les bons prix d'un magasin, tous rayons confondus; cliquer un rayon remet la vue par rayon. Les items du site doivent rester en cartes produit propres avec preuve visuelle ou placeholder, prix lisible et bouton `Ajouter`. Le haut de page doit garder une note source/méthode sous forme de menu fermé par défaut sous le titre `Joliette / Liste d'épicerie`, pas dans la carte de filtres, pour expliquer les magasins, les prix CAD, la limite maximale de 20 items par rayon et le fait qu'un rayon court n'est pas rempli avec de faux deals.
La classification doit rester orientée vraie épicerie: céleri va dans fruits/légumes; poisson pané et viandes froides vont dans viandes/poissons; pizza va dans surgelés même si le nom contient tomate; bologne/bologna, pepperoni, chorizo, rosette, sauciflard, salami, mortadelle et prosciutto vont dans viandes/poissons même si la source brute les place en épicerie/garde-manger. Les familles évidentes comme bologne, sauciflard/chorizo et boeuf haché extra maigre doivent être dédupliquées avant de remplir les rayons; les rosettes de boeuf restent séparées du sauciflard/chorizo.
Après un changement au site ou aux JSON web, lancer `npm run web`, ouvrir `http://localhost:4187`, puis vérifier dans un vrai navigateur que la semaine charge, que les rayons changent sans scroll violent, que le filtre par épicerie affiche seulement les items du magasin choisi, que la recherche trouve des items à travers tous les rayons, qu'une coche ajoute l'item au panier final, qu'un retrait l'enlève, et que `Exporter PDF` crée un PDF propre sur `~/Desktop`. Utiliser Agent Browser ou Playwright quand disponible.

Si tu ouvres ce dossier à neuf, commence par `weeks/`.
