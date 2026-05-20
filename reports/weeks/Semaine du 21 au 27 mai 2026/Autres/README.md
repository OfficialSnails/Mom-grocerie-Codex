# Semaine du 21 au 27 mai 2026

Ouvre ces fichiers dans cet ordre:

1. `../00 Liste d'épicerie.md` — liste finale automatique; coche ici pour enlever un produit
2. `../01 Choix d'items.md` — sélection principale pour ajouter ou enlever des produits
3. `../02 Sélection par épicerie.md` — résumé par magasin en lecture seule
4. `full-report.md` — version complète

Prix: tous les montants sont en CAD. Quand l'unité est connue, elle apparaît dans le prix (`/lb`, `/kg`, `/L`). Les produits au poids peuvent aussi afficher l'équivalent au kg.

Rayons: chaque section peut contenir jusqu'à 20 bons prix, mais seulement si les prix sont réels, vérifiables, utiles et non redondants. Une section courte veut dire qu'il n'y avait pas assez de bons prix solides cette semaine.

Classification: céleri, kiwis, raisins, ail, ananas et avocats sont traités comme fruits/légumes. Goberge, creton, beefsteak, poisson pané, crabe, pollock, surimi et viandes froides sont traités comme viandes/poissons. Papier hygiénique, Kleenex, Q-tips, détergent, savon, shampoing et produits de nettoyage sont traités comme Maison et entretien. Pilules, médicaments et vitamines sont traités comme Santé et pharmacie. Pizza et repas congelés sont traités comme surgelés. Bologne/bologna, pepperoni, chorizo, rosette, sauciflard, salami, mortadelle et prosciutto sont traités comme viandes, même si la source les classe en épicerie/garde-manger.

Déduplication: les familles évidentes comme bologne, sauciflard/chorizo et boeuf haché extra maigre gardent seulement le meilleur représentant. Les rosettes de boeuf restent une famille séparée.

Format visuel: dans `01 Choix d'items.md`, un sommaire de sections apparaît en haut, puis chaque section utilise du Markdown standard. Chaque produit affiche `- [ ] **Produit** — **Prix**`, puis le magasin, l'échelle, la raison et les comparaisons sous le produit. Les preuves photo restent ouvertes directement dans le fichier.

Les fichiers de ce dossier `Autres/` servent à l'audit et au débogage.