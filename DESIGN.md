---
name: Bons spéciaux de la semaine — Québec
brand_identity:
  personality: "Pratique, fiable, serein, québécois."
  tone: "Utile et direct, centré sur l'économie et la clarté."
  target_audience: "Shoppers au Québec, incluant une utilisatrice de 60 ans cherchant la simplicité."

colors:
  surface: "#faf9f6"
  primary: "#2d4739"
  on_primary: "#ffffff"
  secondary: "#5c7066"
  surface_container: "#f4f3f1"
  border: "#dadad7"
  error: "#b3261e"
  success: "#2d4739"

typography:
  family_display: "Playfair Display, Georgia, serif"
  family_body: "Inter, system-ui, sans-serif"
  scales:
    headline_lg: "display, 3xl, bold"
    headline_md: "display, 2xl, bold"
    title_md: "body, lg, semibold"
    body_md: "body, base, normal, relaxed"
    label_sm: "body, xs, medium, uppercase"

spacing:
  container_padding: "16px"
  item_gap: "12px"
  section_margin: "24px"

components:
  card:
    bg: "surface_container"
    radius: "12px"
    border: "1px solid border"
    padding: "12px"
  button_primary:
    bg: "primary"
    text: "on_primary"
    radius: "8px"
    height: "56px"
    text_style: "body, bold, base"
  total_block:
    bg: "primary"
    text: "on_primary"
    radius: "12px"
    layout: "horizontal centered"
    height: "56px"

design_principles:
  - "Une seule ligne par information clé pour éviter le chaos visuel."
  - "Centrage vertical des éléments dans les blocs de résumé."
  - "Hiérarchie claire : le prix est l'information la plus importante."
  - "Boutons larges pour une manipulation facile."
  - "Utilisation de preuves visuelles pour valider les prix."
---

# Guide d'intégration web

Ce document est la source de vérité visuelle pour le site statique `website/`.
Le site doit utiliser ces jetons sans réécrire la structure de l'app: le flux
`Bons prix`, `Tous les produits`, filtres d'épiceries, panier final et PDF
reste prioritaire sur toute exploration visuelle.

## CSS Tokens

Les couleurs sont mappées dans `website/styles.css`:

```css
:root {
  --color-linen-bg: #faf9f6;
  --color-evergreen: #2d4739;
  --color-border-subtle: #dadad7;
}
```

## Cartes Produit

Chaque produit doit garder une grille stable:

- image de preuve ou placeholder stable
- nom du produit
- prix et unité
- magasin
- bouton `Ajouter`

## Bloc Total

Le total doit rester lisible et prudent:

- libellé `TOTAL ESTIMÉ`
- montant en évidence
- note courte pour taxes, dépôts, quantités réelles et prix au poids
- aucun calcul de prix au poids sans quantité réelle
