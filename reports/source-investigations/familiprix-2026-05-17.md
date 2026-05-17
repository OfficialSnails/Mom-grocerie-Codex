# Investigation source — Familiprix

Date: 2026-05-17

## Résumé

Familiprix est utilisable pour la semaine courante, mais la source fiable pour les items détaillés est Flipp/Wishabi, pas la page publique Familiprix.

## Ce qui a été testé

- Firecrawl sur `https://www.familiprix.com/`
- Firecrawl sur `https://www.familiprix.com/fr/circulaire`
- Firecrawl sur une page de catégorie Familiprix liée aux détergents
- Recherche Firecrawl pour les circulaires Familiprix à Joliette
- API Flipp/Wishabi avec le code postal Joliette `J6E3N2`

## Résultat

La page publique Familiprix confirme une circulaire active du 14 au 20 mai, mais elle ne retourne pas une liste d'items/prix assez complète et structurée pour alimenter le rapport sans risque.

L'API Flipp/Wishabi retourne des circulaires Familiprix avec items, prix et images. Le pipeline utilise donc maintenant Familiprix via l'adaptateur Flipp/Wishabi.

## Règle de sécurité

Ne pas inventer d'items Familiprix. Si Flipp/Wishabi ne retourne pas Familiprix une semaine donnée, le rapport doit simplement ne pas inclure Familiprix pour cette semaine et garder une trace dans l'audit.
