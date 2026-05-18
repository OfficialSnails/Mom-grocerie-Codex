import { describe, it, expect } from 'vitest';
import { classifyShopperCategory, deduplicateDisplayDeals, findSuspiciousCategoryItems, findSuspiciousPantryItems, generateMarkdownReport, generateMomReport, generateShoppingListReport, generateShoppingPickerReport, generateStoreSummaryReport, generateVerifiedMomReport, isCostcoGroceryRelevant, scoreAllDeals, shopperStoreId } from '../src/generate-report.js';
import { frenchWeekFolderName, frenchWeekLabel } from '../src/weekly-files.js';
import { matchMerchant, wishabiItemOverlapsDate } from '../sources/flipp-adapter.js';
import type { RawDealItem } from '../sources/source-adapter.js';

const SAMPLE_ITEMS: RawDealItem[] = [
  // Only item from IGA — must still appear in report
  {
    store_id: 'iga-joliette',
    store_name: 'IGA Joliette',
    item_name: 'Poitrine de poulet sans os',
    normalized_name: 'poitrine de poulet',
    category: 'viande',
    current_price: 4.99,
    size: '1',
    unit: 'kg',
    source_system: 'flipp',
    source_type: 'flyer',
    source_url: 'https://example.com/iga-flyer',
    source_flyer_name: 'IGA Hebdo',
    confidence: 'HIGH',
  },
  // Strong deal at Maxi
  {
    store_id: 'maxi-joliette',
    store_name: 'Maxi Joliette',
    item_name: 'Beurre Lactantia 454g',
    normalized_name: 'beurre',
    brand: 'Lactantia',
    category: 'produits-laitiers',
    current_price: 4.88,
    size: '454',
    unit: 'g',
    source_system: 'flipp',
    source_type: 'flyer',
    source_url: 'https://example.com/maxi-flyer',
    source_flyer_name: 'Maxi Hebdo',
    confidence: 'HIGH',
  },
  // Weak deal (fake sale) — should be in À éviter, not Meilleurs spéciaux
  {
    store_id: 'metro-joliette',
    store_name: 'Metro Joliette',
    item_name: 'Café Van Houtte 930g',
    normalized_name: 'cafe',
    brand: 'Van Houtte',
    category: 'epicerie',
    current_price: 12.99,
    size: '930',
    unit: 'g',
    source_system: 'flipp',
    source_type: 'flyer',
    source_url: 'https://example.com/metro-flyer',
    source_flyer_name: 'Metro Hebdo',
    confidence: 'HIGH',
    notes: 'Prix régulier',
  },
];

describe('generateMarkdownReport', () => {
  it('includes IGA item even if it is the only item from that store', () => {
    const scored = scoreAllDeals(SAMPLE_ITEMS);
    const report = generateMarkdownReport(scored, []);

    // IGA item should appear somewhere in the report
    expect(report).toContain('IGA');
    expect(report).toContain('Poitrine de poulet');
  });

  it('does not contain trip optimization language', () => {
    const scored = scoreAllDeals(SAMPLE_ITEMS);
    const report = generateMarkdownReport(scored, []);

    // Should not suggest skipping a store
    expect(report).not.toMatch(/ne vaut pas le déplacement/i);
    expect(report).not.toMatch(/n'allez pas à/i);
    expect(report).not.toMatch(/skip/i);
    expect(report).not.toMatch(/évitez ce magasin/i);
    expect(report).not.toMatch(/trip optimization/i);
  });

  it('contains French labels in report', () => {
    const scored = scoreAllDeals(SAMPLE_ITEMS);
    const report = generateMarkdownReport(scored, []);

    // At least one French label must appear
    const frenchLabels = [
      'Très bon prix',
      'À acheter en extra',
      'Excellent spécial',
      'Bon prix si tu en as besoin',
      'Faux rabais',
      'Attendre',
      "Pas assez d'historique",
    ];

    const hasAnyFrenchLabel = frenchLabels.some(label => report.includes(label));
    expect(hasAnyFrenchLabel).toBe(true);
  });

  it('has the correct French report title', () => {
    const scored = scoreAllDeals(SAMPLE_ITEMS);
    const report = generateMarkdownReport(scored, []);
    expect(report).toContain('# Bons spéciaux de la semaine — Joliette');
  });

  it('contains a section for each store', () => {
    const scored = scoreAllDeals(SAMPLE_ITEMS);
    const report = generateMarkdownReport(scored, []);
    expect(report).toContain('IGA');
    expect(report).toContain('Maxi');
    expect(report).toContain('Metro');
    expect(report).toContain('Super C');
  });

  it('puts weak deals in À éviter section, not Meilleurs spéciaux', () => {
    const scored = scoreAllDeals(SAMPLE_ITEMS);
    const report = generateMarkdownReport(scored, []);

    // Café at regular price should be in À éviter if it is flagged
    const avoidSection = report.split('À éviter cette semaine')[1] ?? '';
    const bestsSection = report.split('## ⭐ Meilleurs spéciaux')[1]?.split('##')[0] ?? '';

    // If café is FAKE_SALE, it should be in avoid section
    const cafeScored = scored.find(d => d.normalized_name === 'cafe');
    if (cafeScored && !cafeScored.worth_buying) {
      expect(avoidSection).toContain('Café');
      expect(bestsSection).not.toContain('Café');
    }
  });

  it('generates report with date and summary line', () => {
    const scored = scoreAllDeals(SAMPLE_ITEMS);
    const report = generateMarkdownReport(scored, []);
    expect(report).toContain('📅');
    expect(report).toContain('📊');
    expect(report).toContain('Semaine du');
  });

  it('adds provenance and CAD note to the report', () => {
    const scored = scoreAllDeals(SAMPLE_ITEMS);
    const report = generateMarkdownReport(scored, []);
    expect(report).toContain('dollars canadiens (CAD)');
    expect(report).toContain('Source: circulaire Flipp');
    expect(report).toContain('[circulaire: IGA Hebdo](https://example.com/iga-flyer)');
  });
});

describe('scoreAllDeals', () => {
  it('returns a scored deal for each item', () => {
    const scored = scoreAllDeals(SAMPLE_ITEMS);
    expect(scored.length).toBe(SAMPLE_ITEMS.length);
  });

  it('each deal has required fields', () => {
    const scored = scoreAllDeals(SAMPLE_ITEMS);
    for (const deal of scored) {
      expect(typeof deal.score).toBe('number');
      expect(typeof deal.label).toBe('string');
      expect(typeof deal.french_label).toBe('string');
      expect(typeof deal.french_reason).toBe('string');
      expect(typeof deal.worth_buying).toBe('boolean');
    }
  });

  it('chicken breast is worth buying', () => {
    const scored = scoreAllDeals(SAMPLE_ITEMS);
    const chicken = scored.find(d => d.normalized_name === 'poitrine de poulet');
    // Chicken at 4.99/kg vs avg ~7.49/kg should be worth buying
    expect(chicken?.worth_buying).toBe(true);
  });
});

describe('generateMomReport', () => {
  it('filters bundle-like flyer lines from the mom report', () => {
    const report = generateMomReport(scoreAllDeals([
      ...SAMPLE_ITEMS,
      {
        store_id: 'superc-joliette',
        store_name: 'Super C Joliette',
        item_name: 'Crevettes, saumon fumé ou gratin pêche du jour, surimi ou calmars frits',
        current_price: 3.88,
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/superc-flyer',
        source_flyer_name: 'Super C Hebdo',
        confidence: 'HIGH',
      },
    ]));

    expect(report).not.toContain('Crevettes, saumon fumé ou gratin pêche du jour');
  });
});

describe('generateVerifiedMomReport', () => {
  it('keeps only strong or high-discount first-seen items in the verified shortlist', () => {
    const { shortlist, markdown } = generateVerifiedMomReport(scoreAllDeals([
      {
        store_id: 'superc-joliette',
        store_name: 'Super C Joliette',
        item_name: 'Yogourt grec 750g',
        normalized_name: 'yogourt grec',
        category: 'produits-laitiers',
        current_price: 3.99,
        size: '750',
        unit: 'g',
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/yogourt',
        source_raw_name: 'Yogourt grec 750g',
        source_raw_price: '3.99',
        source_flyer_name: 'Super C Hebdo',
        flipp_discount_pct: 35,
        confidence: 'HIGH',
      },
      {
        store_id: 'superc-joliette',
        store_name: 'Super C Joliette',
        item_name: 'Boisson énergisante 473ml',
        normalized_name: 'boisson énergisante',
        category: 'boissons',
        current_price: 2.49,
        size: '473',
        unit: 'ml',
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/energy',
        source_raw_name: 'Boisson énergisante 473ml',
        source_raw_price: '2.49',
        source_flyer_name: 'Super C Hebdo',
        flipp_discount_pct: 10,
        confidence: 'HIGH',
      },
    ]));

    expect(shortlist).toHaveLength(1);
    expect(shortlist[0]?.item_name).toContain('Yogourt');
    expect(markdown).toContain('Yogourt grec 750g');
    expect(markdown).not.toContain('Boisson énergisante 473ml');
  });

  it('drops alcohol and weak cross-store winners from the verified shortlist', () => {
    const { shortlist, markdown } = generateVerifiedMomReport(scoreAllDeals([
      {
        store_id: 'metro-joliette',
        store_name: 'Metro Joliette',
        item_name: 'Bière blonde 24 canettes',
        normalized_name: 'biere blonde',
        category: 'boissons',
        current_price: 24.99,
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/beer',
        source_raw_name: 'Bière blonde 24 canettes',
        source_raw_price: '24.99',
        source_flyer_name: 'Metro Hebdo',
        flipp_discount_pct: 30,
        confidence: 'HIGH',
      },
      {
        store_id: 'metro-joliette',
        store_name: 'Metro Joliette',
        item_name: 'Sauce tomate 680ml',
        normalized_name: 'sauce tomate',
        category: 'epicerie',
        current_price: 4.49,
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/sauce-metro',
        source_raw_name: 'Sauce tomate 680ml',
        source_raw_price: '4.49',
        source_flyer_name: 'Metro Hebdo',
        confidence: 'HIGH',
      },
      {
        store_id: 'iga-joliette',
        store_name: 'IGA Joliette',
        item_name: 'Sauce tomate 680ml',
        normalized_name: 'sauce tomate',
        category: 'epicerie',
        current_price: 4.69,
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/sauce-iga',
        source_raw_name: 'Sauce tomate 680ml',
        source_raw_price: '4.69',
        source_flyer_name: 'IGA Hebdo',
        confidence: 'HIGH',
      },
    ]));

    expect(shortlist).toHaveLength(0);
    expect(markdown).toContain("Aucun produit n'a passé la vérification stricte");
    expect(markdown).not.toContain('Bière blonde 24 canettes');
    expect(markdown).not.toContain('Sauce tomate 680ml');
  });
});

describe('weekly shopper-facing reports', () => {
  it('organizes the shopping list by category and names the winning store', () => {
    const shortlist = [
      {
        store_id: 'metro-joliette',
        store_name: 'Metro Joliette',
        item_name: 'Poitrines de poulet fraîches désossées',
        normalized_name: 'poitrine de poulet',
        category: 'viande',
        current_price: 5.44,
        unit: 'lb',
        source_url: 'https://example.com/chicken-metro',
        source_image_url: 'https://example.com/chicken-metro.jpg',
        score: 60,
        label: 'NOT_ENOUGH_HISTORY',
        french_label: 'Premier aperçu',
        french_reason: 'Premier aperçu',
        worth_buying: false,
        cross_store_winner: true,
        cross_store_savings: 1.05,
        cross_store_competitor_prices: ['Marchés Tradition 6,49 $/lb'],
        verification_status: 'VERIFIED_FLYER_STRUCTURED',
        verification_confidence: 'HIGH',
        verification_reason: 'ok',
      },
      {
        store_id: 'maxi-joliette',
        store_name: 'Maxi Joliette',
        item_name: 'Fraises',
        normalized_name: 'fraises',
        category: 'fruits',
        current_price: 4.49,
        source_url: 'https://example.com/strawberries',
        source_image_url: 'https://example.com/strawberries.jpg',
        score: 85,
        label: 'GREAT_DEAL',
        french_label: 'Très bon prix',
        french_reason: 'Environ 51 % moins cher que le prix habituel.',
        worth_buying: true,
        verification_status: 'VERIFIED_FLYER_STRUCTURED',
        verification_confidence: 'HIGH',
        verification_reason: 'ok',
      },
    ];

    const shopping = generateShoppingListReport(shortlist);
    expect(shopping).toContain('## 🥩 Viandes et poissons');
    expect(shopping).toContain('## 🥬 Fruits et légumes');
    expect(shopping).toContain('Metro');
    expect(shopping).toContain('Gagne contre Marchés Tradition 6,49 $/lb');
    expect(shopping).toContain('📸 Preuve du prix');
    expect(shopping).toContain('<img src="https://example.com/chicken-metro.jpg"');
  });

  it('keeps only the strongest version of a duplicated product family in a category', () => {
    const shortlist = [
      {
        store_id: 'maxi-joliette',
        store_name: 'Maxi Joliette',
        item_name: 'FRAISES',
        normalized_name: 'fraises',
        category: 'fruits',
        current_price: 4.49,
        source_image_url: 'https://example.com/fraises-maxi.jpg',
        score: 85,
        label: 'GREAT_DEAL',
        french_label: 'Très bon prix',
        french_reason: 'Environ 51 % moins cher que le prix habituel.',
        worth_buying: true,
        verification_status: 'VERIFIED_FLYER_STRUCTURED',
        verification_confidence: 'HIGH',
        verification_reason: 'ok',
      },
      {
        store_id: 'metro-joliette',
        store_name: 'Metro Joliette',
        item_name: 'FRAISES DE SERRE',
        normalized_name: 'fraises',
        category: 'fruits',
        current_price: 4.99,
        source_image_url: 'https://example.com/fraises-metro.jpg',
        score: 80,
        label: 'GREAT_DEAL',
        french_label: 'Très bon prix',
        french_reason: 'Environ 46 % moins cher que le prix habituel.',
        worth_buying: true,
        verification_status: 'VERIFIED_FLYER_STRUCTURED',
        verification_confidence: 'HIGH',
        verification_reason: 'ok',
      },
      {
        store_id: 'iga-joliette',
        store_name: 'IGA Joliette',
        item_name: 'BLEUETS',
        normalized_name: 'bleuets',
        category: 'fruits',
        current_price: 3.99,
        source_image_url: 'https://example.com/bleuets.jpg',
        score: 70,
        label: 'GOOD_IF_NEEDED',
        french_label: 'Bon prix si tu en as besoin',
        french_reason: 'Bon prix si tu en as besoin.',
        worth_buying: true,
        verification_status: 'VERIFIED_FLYER_STRUCTURED',
        verification_confidence: 'HIGH',
        verification_reason: 'ok',
      },
    ];

    const shopping = generateShoppingListReport(shortlist);
    expect(shopping).toContain('FRAISES');
    expect(shopping).not.toContain('FRAISES DE SERRE');
    expect(shopping).toContain('BLEUETS');
  });

  it('builds a store summary from the shortlisted weekly items', () => {
    const shortlist = [
      {
        store_id: 'iga-joliette',
        store_name: 'IGA Joliette',
        item_name: "Beurre Lactantia",
        normalized_name: 'beurre',
        category: 'produits-laitiers',
        current_price: 2.99,
        source_url: 'https://example.com/butter',
        source_image_url: 'https://example.com/butter.jpg',
        score: 90,
        label: 'MUST_BUY',
        french_label: 'Excellent prix',
        french_reason: 'Parmi les meilleurs vus dans les 6 derniers mois.',
        worth_buying: true,
        verification_status: 'VERIFIED_FLYER_STRUCTURED',
        verification_confidence: 'HIGH',
        verification_reason: 'ok',
      },
    ];

    const summary = generateStoreSummaryReport(shortlist);
    expect(summary).toContain('## 🏬 IGA');
    expect(summary).toContain('Produits laitiers et oeufs');
    expect(summary).toContain('📸 Preuve du prix');
    expect(summary).toContain('<img src="https://example.com/butter.jpg"');
    expect(summary).not.toContain('- [ ]');
  });

  it('shows sale scale for lb-priced weighted items', () => {
    const shortlist = [
      {
        store_id: 'maxi-joliette',
        store_name: 'Maxi Joliette',
        item_name: 'POMMES RED PRINCE',
        normalized_name: 'pommes red prince',
        category: 'fruits',
        current_price: 2,
        unit: 'lb',
        normalized_price_per_unit: 4.41,
        normalized_unit: 'kg',
        source_url: 'https://example.com/apples',
        source_image_url: 'https://example.com/apples.jpg',
        score: 70,
        label: 'GOOD_IF_NEEDED',
        french_label: 'Bon prix si tu en as besoin',
        french_reason: 'Bon prix si tu en as besoin.',
        worth_buying: true,
        verification_status: 'VERIFIED_FLYER_STRUCTURED',
        verification_confidence: 'HIGH',
        verification_reason: 'ok',
      },
    ];

    const picker = generateShoppingPickerReport(shortlist).markdown;
    expect(picker).toContain('## Sections');
    expect(picker).toContain('[[#🥬 Fruits et légumes|🥬 Fruits et légumes]]');
    expect(picker).toContain('## 🥬 Fruits et légumes');
    expect(picker).toContain('- [ ] **POMMES RED PRINCE** — **2,00 $/lb**');
    expect(picker).toContain('⚖️ **Échelle:** Équivaut à 4,41 $/kg.');
    expect(picker).not.toContain('<details>');
    expect(picker).not.toContain('<summary>');
    expect(picker).not.toContain('> [!info]-');
  });

  it('classifies deli meats as meat and celery as produce even with weak source categories', () => {
    const baseDeal = {
      store_id: 'maxi-joliette',
      store_name: 'Maxi Joliette',
      current_price: 2.99,
      source_image_url: 'https://example.com/proof.jpg',
      score: 70,
      label: 'GOOD_IF_NEEDED',
      french_label: 'Bon prix si tu en as besoin',
      french_reason: 'Bon prix si tu en as besoin.',
      worth_buying: true,
      verification_status: 'VERIFIED_FLYER_STRUCTURED',
      verification_confidence: 'HIGH',
      verification_reason: 'ok',
    };

    const picker = generateShoppingPickerReport([
      {
        ...baseDeal,
        item_name: 'CÉLERI',
        normalized_name: 'celeri',
        category: 'epicerie',
      },
      {
        ...baseDeal,
        item_name: 'ROMA PEPPERONI TRANCHE',
        normalized_name: 'roma pepperoni tranche',
        category: 'epicerie',
      },
      {
        ...baseDeal,
        item_name: 'LE SAUCIFLARD ROSETTE DE LYON OU CHORIZO',
        normalized_name: 'sauciflard rosette lyon chorizo',
        category: 'epicerie',
      },
      {
        ...baseDeal,
        item_name: 'BOLOGNE EN LIEN',
        normalized_name: 'bologne en lien',
        category: 'epicerie',
      },
    ]).markdown;

    const produceSection = picker.split('## 🥬 Fruits et légumes')[1]?.split('## 🥩 Viandes et poissons')[0] ?? '';
    const meatSection = picker.split('## 🥩 Viandes et poissons')[1]?.split('##')[0] ?? '';

    expect(produceSection).toContain('CÉLERI');
    expect(meatSection).toContain('ROMA PEPPERONI TRANCHE');
    expect(meatSection).toContain('LE SAUCIFLARD ROSETTE DE LYON OU CHORIZO');
    expect(meatSection).toContain('BOLOGNE EN LIEN');
  });

  it('keeps frozen pizza out of produce and fish portions out of snacks', () => {
    const baseDeal = {
      store_id: 'maxi-joliette',
      store_name: 'Maxi Joliette',
      current_price: 4.99,
      source_image_url: 'https://example.com/proof.jpg',
      score: 70,
      label: 'GOOD_IF_NEEDED',
      french_label: 'Bon prix si tu en as besoin',
      french_reason: 'Bon prix si tu en as besoin.',
      worth_buying: true,
      verification_status: 'VERIFIED_FLYER_STRUCTURED',
      verification_confidence: 'HIGH',
      verification_reason: 'ok',
    };

    const picker = generateShoppingPickerReport([
      {
        ...baseDeal,
        item_name: 'Pizza aux tomates Rustica',
        normalized_name: 'pizza rustica tomates',
        category: 'epicerie',
      },
      {
        ...baseDeal,
        item_name: 'PORTIONS DE POISSON PANÉES BLUE WATER',
        normalized_name: 'portions de poisson panees',
        category: 'collations',
      },
    ]).markdown;

    const meatSection = picker.split('## 🥩 Viandes et poissons')[1]?.split('## 🧊 Surgelés')[0] ?? '';
    const frozenSection = picker.split('## 🧊 Surgelés')[1]?.split('##')[0] ?? '';
    const produceSection = picker.split('## 🥬 Fruits et légumes')[1]?.split('##')[0] ?? '';

    expect(frozenSection).toContain('Pizza aux tomates Rustica');
    expect(meatSection).toContain('PORTIONS DE POISSON PANÉES BLUE WATER');
    expect(produceSection).not.toContain('Pizza aux tomates Rustica');
  });

  it('classifies strong categories before pantry fallback', () => {
    const baseDeal = {
      store_id: 'familiprix-joliette',
      store_name: 'Familiprix Joliette',
      current_price: 4.99,
      source_image_url: 'https://example.com/proof.jpg',
      score: 70,
      label: 'GOOD_IF_NEEDED',
      french_label: 'Bon prix si tu en as besoin',
      french_reason: 'Bon prix si tu en as besoin.',
      worth_buying: true,
      verification_status: 'VERIFIED_FLYER_STRUCTURED',
      verification_confidence: 'HIGH',
      verification_reason: 'ok',
    };

    const cases: Array<[string, string, string, string]> = [
      ['Flocons de goberge à saveur de crabe Selection', 'epicerie', 'goberge saveur crabe', 'meat-fish'],
      ['Beefsteak de boeuf', 'epicerie', 'beefsteak boeuf', 'meat-fish'],
      ['TOMATES BEEFSTEAK SAVOURA', 'epicerie', 'tomates beefsteak', 'produce'],
      ['Creton maison', 'epicerie', 'creton maison', 'meat-fish'],
      ['Ananas frais', 'epicerie', 'ananas frais', 'produce'],
      ['Pineapple chunks', 'epicerie', 'pineapple chunks', 'produce'],
      ['Kiwis verts', 'epicerie', 'kiwis verts', 'produce'],
      ['Raisins rouges sans pépins', 'epicerie', 'raisins rouges', 'produce'],
      ['Green grapes', 'epicerie', 'green grapes', 'produce'],
      ['Avocat', 'epicerie', 'avocat', 'produce'],
      ['Avocado', 'epicerie', 'avocado', 'produce'],
      ['Ail frais', 'epicerie', 'ail frais', 'produce'],
      ['Garlic bulbs', 'epicerie', 'garlic bulbs', 'produce'],
      ['Beignes glacés', 'epicerie', 'beignes glaces', 'bakery'],
      ['Donuts assortis', 'epicerie', 'donuts assortis', 'bakery'],
      ["Mike's frozen pasta dinners", 'epicerie', 'mikes frozen pasta dinners', 'frozen'],
      ['Dîner de pâtes surgelé Mike’s', 'epicerie', 'diner de pates surgele mikes', 'frozen'],
      ['Pâtés impériaux surgelés', 'epicerie', 'pates imperiaux surgeles', 'frozen'],
      ['Egg rolls frozen', 'epicerie', 'egg rolls frozen', 'frozen'],
      ["Beurre à l'ail Lactantia", 'epicerie', 'beurre ail', 'dairy-eggs'],
      ['CRÈME GLACÉE TOURBILLON-ARC-EN CIEL BAR', 'fruit', 'creme glacee tourbillon arc en ciel bar', 'frozen'],
      ['TARTE-GÂTEAU AU FROMAGE LE TRIPLE DÉLICE, FRANCHEMENT FRAISE', 'fruit', 'tarte gateau au fromage franchement fraise', 'dairy-eggs'],
      ['Pilules contre les allergies', 'epicerie', 'pilules allergies', 'health'],
      ['Tylenol médicament', 'epicerie', 'tylenol medicament', 'health'],
      ['Café moulu', 'epicerie', 'cafe moulu', 'pantry'],
      ['Colorant à café', 'epicerie', 'colorant cafe', 'pantry'],
      ['Sauce tomate', 'epicerie', 'sauce tomate', 'pantry'],
      ["BARQUETTE DE LÉGUMES C'EST PRÊT! À CUIRE", 'epicerie', 'barquette de legumes cest pret a cuire', 'produce'],
      ["CARROUSEL DE FRUITS C'EST PRÊT!", 'epicerie', 'carrousel de fruits cest pret', 'produce'],
      ["CARROUSEL DE FRUITS OU DE LÉGUMES C'EST PRÊT!", 'epicerie', 'carrousel de fruits ou de legumes cest pret', 'produce'],
      ['MAÏS EN ÉPI DEUX COULEURS', 'epicerie', 'mais en epi deux couleurs', 'produce'],
      ['PLATEAU DE CRUDITÉS', 'epicerie', 'plateau de crudites', 'produce'],
      ['BARQUETTE DE LÉGUMES', 'epicerie', 'barquette de legumes', 'produce'],
      ['PLATEAU DE FRUITS', 'epicerie', 'plateau de fruits', 'produce'],
      ["Boîte à lunch C'est prêt", 'epicerie', 'boite a lunch cest pret', 'pantry'],
      ["Repas préparé C'est prêt", 'epicerie', 'repas prepare cest pret', 'pantry'],
    ];

    for (const [item_name, category, normalized_name, expected] of cases) {
      expect(classifyShopperCategory({
        ...baseDeal,
        item_name,
        normalized_name,
        category,
      })).toBe(expected);
    }

    expect(classifyShopperCategory({
      ...baseDeal,
      item_name: 'MAÏS EN ÉPIS DEUX COULEURS',
      normalized_name: 'mais en epis deux couleurs',
      source_raw_name: 'MAÏS EN ÉPIS DEUX COULEURS | PEACHES AND CREAM CORN ON THE COB',
      category: 'epicerie',
    })).toBe('produce');
  });

  it('finds high-confidence suspicious pantry items for QA review', () => {
    const findings = findSuspiciousPantryItems([
      {
        name: "BARQUETTE DE LÉGUMES C'EST PRÊT! À CUIRE",
        storeName: 'IGA Joliette',
        price: '5,99 $',
        categoryId: 'pantry',
      },
      {
        name: 'Sauce tomate',
        storeName: 'Metro Joliette',
        price: '1,99 $',
        categoryId: 'pantry',
      },
      {
        name: "Beurre à l'ail Lactantia",
        storeName: 'IGA Joliette',
        price: '3,99 $',
        categoryId: 'pantry',
      },
      {
        name: "Boîte à lunch C'est prêt",
        storeName: 'IGA Joliette',
        price: '7,99 $',
        categoryId: 'pantry',
      },
    ]);

    expect(findings).toEqual([
      expect.objectContaining({
        itemName: "BARQUETTE DE LÉGUMES C'EST PRÊT! À CUIRE",
        suggestedCategory: 'produce',
      }),
      expect.objectContaining({
        itemName: "Beurre à l'ail Lactantia",
        suggestedCategory: 'dairy-eggs',
      }),
    ]);
  });

  it('scans suspicious placements across all generated categories', () => {
    const findings = findSuspiciousCategoryItems([
      {
        id: 'dairy-eggs',
        title: 'Produits laitiers et oeufs',
        items: [{
          name: 'MAÏS EN ÉPIS DEUX COULEURS',
          source_raw_name: 'MAÏS EN ÉPIS DEUX COULEURS | PEACHES AND CREAM CORN ON THE COB',
          storeName: 'Metro Joliette',
          price: '3,99 $',
          categoryId: 'dairy-eggs',
          categoryTitle: 'Produits laitiers et oeufs',
        }],
      },
      {
        id: 'produce',
        title: 'Fruits et légumes',
        items: [{
          name: 'Sauce tomate',
          storeName: 'Metro Joliette',
          price: '1,99 $',
          categoryId: 'produce',
          categoryTitle: 'Fruits et légumes',
        }],
      },
      {
        id: 'pantry',
        title: 'Garde-manger et autres',
        items: [{
          name: 'Collations aux fruits',
          storeName: 'Super C Joliette',
          price: '2,99 $',
          categoryId: 'pantry',
          categoryTitle: 'Garde-manger et autres',
        }],
      },
    ]);

    expect(findings).toEqual([
      expect.objectContaining({
        itemName: 'MAÏS EN ÉPIS DEUX COULEURS',
        suggestedCategory: 'produce',
        severity: 'high',
      }),
      expect.objectContaining({
        itemName: 'Collations aux fruits',
        suggestedCategory: 'snacks-drinks',
        severity: 'ambiguous',
      }),
    ]);
  });

  it('classifies household essentials as Maison et entretien', () => {
    const baseDeal = {
      store_id: 'familiprix-joliette',
      store_name: 'Familiprix Joliette',
      current_price: 4.99,
      source_image_url: 'https://example.com/proof.jpg',
      score: 70,
      label: 'GOOD_IF_NEEDED',
      french_label: 'Bon prix si tu en as besoin',
      french_reason: 'Bon prix si tu en as besoin.',
      worth_buying: true,
      verification_status: 'VERIFIED_FLYER_STRUCTURED',
      verification_confidence: 'HIGH',
      verification_reason: 'ok',
    };

    for (const item_name of [
      'Détergent Tide sélectionné',
      'Kleenex mouchoirs',
      'Q-tips coton-tiges',
      'Papier toilette Cashmere',
      'Papier de toilette Royale',
      'Essuie-tout SpongeTowels',
    ]) {
      expect(classifyShopperCategory({
        ...baseDeal,
        item_name,
        normalized_name: item_name.toLowerCase(),
        category: 'maison',
      })).toBe('household');
    }
  });

  it('classifies pharmacy essentials outside pantry', () => {
    const baseDeal = {
      store_id: 'familiprix-joliette',
      store_name: 'Familiprix Joliette',
      current_price: 4.99,
      source_image_url: 'https://example.com/proof.jpg',
      score: 70,
      label: 'GOOD_IF_NEEDED',
      french_label: 'Bon prix si tu en as besoin',
      french_reason: 'Bon prix si tu en as besoin.',
      worth_buying: true,
      verification_status: 'VERIFIED_FLYER_STRUCTURED',
      verification_confidence: 'HIGH',
      verification_reason: 'ok',
    };

    for (const item_name of [
      'Pansements Band-Aid',
      'Médicament pour allergies',
      'Polysporin onguent antibiotique',
      'Vitamines Jamieson',
    ]) {
      expect(classifyShopperCategory({
        ...baseDeal,
        item_name,
        normalized_name: item_name.toLowerCase(),
        category: 'pharmacie',
      })).toBe('health');
    }
  });

  it('deduplicates same-store same-price same-image full-product flyer variants', () => {
    const baseDeal = {
      store_id: 'familiprix-joliette',
      store_name: 'Familiprix Joliette',
      category: 'maison',
      current_price: 4.99,
      source_image_url: 'https://example.com/familiprix-degree.jpg',
      source_system: 'flipp',
      source_type: 'flyer',
      source_url: 'https://example.com/flyer',
      source_raw_name: 'DEGREE Antisudorifiques ou désodorisants sélectionnés',
      source_raw_price: '4.99',
      confidence: 'HIGH',
      score: 50,
      label: 'GOOD_IF_NEEDED',
      french_label: 'Bon prix si tu en as besoin',
      french_reason: 'Bon prix si tu en as besoin.',
      worth_buying: false,
    } as const;

    const deduped = deduplicateDisplayDeals([
      {
        ...baseDeal,
        item_name: 'DEGREE Antisudorifiques ou désodorisants sélectionnés',
        normalized_name: 'degree antisudorifiques desodorisants selectionnes',
      },
      {
        ...baseDeal,
        item_name: 'DEGREE, Antisudorifiques ou désodorisants sélectionnés',
        normalized_name: 'degree antisudorifiques desodorisants selectionnes',
      },
      {
        ...baseDeal,
        source_image_url: 'https://example.com/familiprix-carefree.jpg',
        item_name: 'CAREFREE Protège-dessous sélectionnés',
        normalized_name: 'carefree protege dessous selectionnes',
      },
      {
        ...baseDeal,
        source_image_url: 'https://example.com/familiprix-carefree.jpg',
        item_name: 'CAREFREE, Protège-dessous sélectionnés',
        normalized_name: 'carefree protege dessous selectionnes',
      },
      {
        ...baseDeal,
        source_image_url: 'https://example.com/familiprix-old-spice.jpg',
        item_name: 'OLD SPICE, Désodorisant pour tout le corps sans aluminium',
        normalized_name: 'old spice desodorisant corps sans aluminium',
      },
      {
        ...baseDeal,
        source_image_url: 'https://example.com/familiprix-old-spice.jpg',
        item_name: 'OLD SPICE, Désodorisant pour tout le corps sans aluminium, 68 g à 99 g',
        normalized_name: 'old spice desodorisant corps sans aluminium 68 g 99 g',
      },
    ]);

    expect(deduped).toHaveLength(3);
    expect(deduped.map(deal => deal.item_name)).toContain('OLD SPICE, Désodorisant pour tout le corps sans aluminium, 68 g à 99 g');
  });

  it('keeps distinct full-product cards when store, image, or title meaning differs', () => {
    const baseDeal = {
      store_id: 'familiprix-joliette',
      store_name: 'Familiprix Joliette',
      category: 'maison',
      current_price: 4.99,
      source_image_url: 'https://example.com/familiprix-degree.jpg',
      source_system: 'flipp',
      source_type: 'flyer',
      source_url: 'https://example.com/flyer',
      source_raw_name: 'DEGREE Antisudorifiques',
      source_raw_price: '4.99',
      confidence: 'HIGH',
      score: 50,
      label: 'GOOD_IF_NEEDED',
      french_label: 'Bon prix si tu en as besoin',
      french_reason: 'Bon prix si tu en as besoin.',
      worth_buying: false,
      item_name: 'DEGREE Antisudorifiques',
      normalized_name: 'degree antisudorifiques',
    } as const;

    expect(deduplicateDisplayDeals([
      baseDeal,
      { ...baseDeal, store_id: 'metro-joliette', store_name: 'Metro Joliette' },
    ])).toHaveLength(2);
    expect(deduplicateDisplayDeals([
      baseDeal,
      {
        ...baseDeal,
        source_image_url: 'https://example.com/familiprix-carefree.jpg',
        item_name: 'CAREFREE Protège-dessous sélectionnés',
        normalized_name: 'carefree protege dessous selectionnes',
      },
    ])).toHaveLength(2);
    expect(deduplicateDisplayDeals([
      baseDeal,
      {
        ...baseDeal,
        item_name: 'CAREFREE Protège-dessous sélectionnés',
        normalized_name: 'carefree protege dessous selectionnes',
      },
    ])).toHaveLength(2);
  });

  it('deduplicates obvious same-family meat items before filling a category', () => {
    const baseDeal = {
      store_id: 'maxi-joliette',
      store_name: 'Maxi Joliette',
      current_price: 10.99,
      source_image_url: 'https://example.com/proof.jpg',
      score: 70,
      label: 'GOOD_IF_NEEDED',
      french_label: 'Bon prix si tu en as besoin',
      french_reason: 'Bon prix si tu en as besoin.',
      worth_buying: true,
      verification_status: 'VERIFIED_FLYER_STRUCTURED',
      verification_confidence: 'HIGH',
      verification_reason: 'ok',
    };

    const picker = generateShoppingPickerReport([
      {
        ...baseDeal,
        item_name: 'LE SAUCIFLARD ROSETTE DE LYON OU CHORIZO',
        normalized_name: 'le sauciflard rosette de lyon ou chorizo',
      },
      {
        ...baseDeal,
        store_id: 'iga-joliette',
        store_name: 'IGA Joliette',
        item_name: 'ROSETTE DE LYON OU CHORIZO LE SAUCIFLARD',
        normalized_name: 'rosette de lyon ou chorizo le sauciflard',
      },
      {
        ...baseDeal,
        current_price: 5.49,
        item_name: 'Boeuf haché extra maigre',
        normalized_name: 'boeuf hache extra maigre',
      },
      {
        ...baseDeal,
        current_price: 8.99,
        item_name: 'BŒUF HACHÉ EXTRA-MAIGRE',
        normalized_name: 'bœuf haché extra-maigre',
      },
    ]).markdown;

    expect(picker).toContain('LE SAUCIFLARD ROSETTE DE LYON OU CHORIZO');
    expect(picker).not.toContain('ROSETTE DE LYON OU CHORIZO LE SAUCIFLARD');
    expect(picker).toContain('Boeuf haché extra maigre');
    expect(picker).not.toContain('BŒUF HACHÉ EXTRA-MAIGRE');
  });

  it('compares same product families across stores even when flyer item names differ slightly', () => {
    const { markdown } = generateVerifiedMomReport(scoreAllDeals([
      {
        store_id: 'metro-joliette',
        store_name: 'Metro Joliette',
        item_name: 'RÔTI DE BAS DE PALETTE DÉSOSSÉ',
        category: 'viande',
        current_price: 12.99,
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/roti-metro',
        source_raw_name: 'RÔTI DE BAS DE PALETTE DÉSOSSÉ | BONELESS BOTTOM BLADE ROAST',
        source_raw_price: '12.99',
        confidence: 'HIGH',
      },
      {
        store_id: 'maxi-joliette',
        store_name: 'Maxi Joliette',
        item_name: 'RÔTI DE BAS DE PALETTE DE BŒUF DÉSOSSÉ',
        category: 'viande',
        current_price: 14.99,
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/roti-maxi',
        source_raw_name: 'RÔTI DE BAS DE PALETTE DE BŒUF DÉSOSSÉ | BEEF BONELESS BOTTOM BLADE ROAST',
        source_raw_price: '14.99',
        confidence: 'HIGH',
      },
      {
        store_id: 'superc-joliette',
        store_name: 'Super C Joliette',
        item_name: 'Rôti de bas de palette désossé',
        category: 'viande',
        current_price: 8.99,
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/roti-superc',
        source_raw_name: 'rôti de bas de palette désossé | boneless bottom blade roast or stewing beef cubes',
        source_raw_price: '8.99',
        confidence: 'HIGH',
      },
    ]));

    expect(markdown).toContain('Metro 12,99 $');
    expect(markdown).toContain('Maxi 14,99 $');
  });
});

describe('flyer week labels', () => {
  it('uses the Thursday-to-Wednesday flyer cycle', () => {
    expect(frenchWeekLabel(new Date('2026-05-17T12:00:00-04:00'))).toBe('14 au 20 mai 2026');
    expect(frenchWeekFolderName(new Date('2026-05-17T12:00:00-04:00'))).toBe('Semaine du 14 au 20 mai 2026');
    expect(frenchWeekLabel(new Date('2026-05-21T12:00:00-04:00'))).toBe('21 au 27 mai 2026');
  });
});

describe('website user-facing wording and week filtering', () => {
  it('maps Costco through Flipp and filters item validity by date', () => {
    expect(matchMerchant('Costco')).toEqual({ store_id: 'costco-quebec', store_name: 'Costco' });
    expect(matchMerchant('IGA')).toEqual({ store_id: 'iga-joliette', store_name: 'IGA' });

    const currentItem = {
      valid_from: '2026-05-11T00:00:00-04:00',
      valid_to: '2026-06-14T23:59:59-04:00',
    };
    const futureItem = {
      valid_from: '2026-05-25T00:00:00-04:00',
      valid_to: '2026-06-14T23:59:59-04:00',
    };

    expect(wishabiItemOverlapsDate(currentItem, new Date('2026-05-18T12:00:00-04:00'))).toBe(true);
    expect(wishabiItemOverlapsDate(futureItem, new Date('2026-05-18T12:00:00-04:00'))).toBe(false);
    expect(wishabiItemOverlapsDate(futureItem, new Date('2026-05-26T12:00:00-04:00'))).toBe(true);
  });

  it('uses generic Quebec-facing store names and includes Costco in website export metadata', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../src/generate-report.ts', import.meta.url), 'utf8');
    const adapter = await readFile(new URL('../sources/flipp-adapter.ts', import.meta.url), 'utf8');

    expect(source).toContain("'costco-quebec': 'Costco'");
    expect(shopperStoreId('bonichoix-stemilie')).toBe('bonichoix-joliette');
    expect(source).toContain("'iga-joliette': 'IGA'");
    expect(source).toContain("'maxi-joliette': 'Maxi'");
    expect(source).toContain("'bonichoix-stemilie': 'BoniChoix'");
    expect(source).not.toContain("'iga-joliette': 'IGA Joliette'");
    expect(source).not.toContain("'maxi-joliette': 'Maxi Joliette'");
    expect(source).toContain('Costco peut avoir des prix membre');
    expect(adapter).toContain("store_id: 'costco-quebec'");
    expect(adapter).toContain("store_name: 'Costco'");
  });

  it('keeps Costco grocery-relevant products and excludes obvious non-grocery offers', () => {
    const scored = scoreAllDeals([
      {
        store_id: 'costco-quebec',
        store_name: 'Costco',
        item_name: 'Chandails Puma pour femmes',
        normalized_name: 'chandails puma',
        category: 'Vêtements',
        current_price: 19.99,
        unit: 'ea',
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/costco',
        confidence: 'HIGH',
      },
      {
        store_id: 'costco-quebec',
        store_name: 'Costco',
        item_name: 'Céréales Cheerios format familial',
        normalized_name: 'cereales cheerios',
        category: 'Épicerie',
        current_price: 8.99,
        unit: 'ea',
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/costco',
        confidence: 'HIGH',
      },
      {
        store_id: 'costco-quebec',
        store_name: 'Costco',
        item_name: 'Papier hygiénique Kirkland',
        normalized_name: 'papier hygienique kirkland',
        category: 'Maison',
        current_price: 21.99,
        unit: 'ea',
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/costco',
        confidence: 'HIGH',
      },
      {
        store_id: 'costco-quebec',
        store_name: 'Costco',
        item_name: 'Ventilateur de plancher',
        normalized_name: 'ventilateur de plancher',
        category: 'Maison',
        current_price: 49.99,
        unit: 'ea',
        source_system: 'flipp',
        source_type: 'flyer',
        source_url: 'https://example.com/costco',
        confidence: 'HIGH',
      },
    ]);

    expect(isCostcoGroceryRelevant(scored[0])).toBe(false);
    expect(isCostcoGroceryRelevant(scored[1])).toBe(true);
    expect(isCostcoGroceryRelevant(scored[2])).toBe(true);
    expect(isCostcoGroceryRelevant(scored[3])).toBe(false);
  });

  it('uses natural product wording instead of items vus', async () => {
    const { readFile } = await import('node:fs/promises');
    const [html, js, css] = await Promise.all([
      readFile(new URL('../website/index.html', import.meta.url), 'utf8'),
      readFile(new URL('../website/app.js', import.meta.url), 'utf8'),
      readFile(new URL('../website/styles.css', import.meta.url), 'utf8'),
    ]);

    expect(html).toContain('Tous les produits');
    expect(html).toContain('Rechercher un produit');
    expect(js).toContain('produits trouvés');
    expect(js).toContain('produit${store.count > 1 ?');
    expect(html).not.toContain('Tous les items');
    expect(html).not.toContain('Rechercher un item');
    expect(js).not.toContain('items vus');
    expect(js).not.toContain('Item vu');
  });

  it('keeps only the latest production week visible unless debug weeks are enabled', async () => {
    const { readFile } = await import('node:fs/promises');
    const js = await readFile(new URL('../website/app.js', import.meta.url), 'utf8');

    expect(js).toContain('function visibleWeeks');
    expect(js).toContain('debugWeeks');
    expect(js).toContain('manual-preview');
    expect(js).toContain('productionWeeks.slice(0, 1)');
  });

  it('uses Tous as a virtual category scoped to mode and store', async () => {
    const { readFile } = await import('node:fs/promises');
    const js = await readFile(new URL('../website/app.js', import.meta.url), 'utf8');

    expect(js).toContain("activeCategoryId: 'all'");
    expect(js).toContain('const ALL_CATEGORY = {');
    expect(js).toContain("id: 'all'");
    expect(js).toContain("title: 'Tous'");
    expect(js).toContain('function displayCategories()');
    expect(js).toContain('return [ALL_CATEGORY, ...currentCategories()]');
    expect(js).toContain("if (category?.id === 'all')");
    expect(js).toContain('function itemMatchesSelectedStores(item)');
    expect(js).toContain('return items.filter(itemMatchesSelectedStores)');
  });

  it('shows only available totals on category cards', async () => {
    const { readFile } = await import('node:fs/promises');
    const js = await readFile(new URL('../website/app.js', import.meta.url), 'utf8');

    const renderCategoryTabs = js.slice(js.indexOf('function renderCategoryTabs()'), js.indexOf('function renderStoreFilter()'));
    expect(renderCategoryTabs).toContain('<span class="category-count">${scopedItems.length}</span>');
    expect(renderCategoryTabs).not.toContain('selectedCount');
    expect(renderCategoryTabs).not.toContain('${selectedCount > 0');
  });

  it('shows safe estimated totals in the final list and PDF exports', async () => {
    const { readFile } = await import('node:fs/promises');
    const [html, js, css, server, skill, agents] = await Promise.all([
      readFile(new URL('../website/index.html', import.meta.url), 'utf8'),
      readFile(new URL('../website/app.js', import.meta.url), 'utf8'),
      readFile(new URL('../website/styles.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/serve-website.ts', import.meta.url), 'utf8'),
      readFile(new URL('../SKILL.md', import.meta.url), 'utf8'),
      readFile(new URL('../AGENTS.md', import.meta.url), 'utf8'),
    ]);

    expect(html).toContain('selection-estimate');
    expect(js).toContain('function estimateBasketTotal');
    expect(js).toContain('Total estimé');
    expect(js).toContain('Avant taxes, dépôts, quantités réelles et prix au poids');
    expect(js).toContain('Sous-total estimé');
    expect(js).toContain('Total estimé de la liste');
    expect(js).toContain('let exportStatusTimer = null');
    expect(js).toContain("tone === 'success'");
    expect(js).toContain('}, 5000)');
    expect(css).not.toContain('.topbar {\n  position: sticky');
    const selectionPanelCss = css.match(/\.selection-panel\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(selectionPanelCss).toContain('display: flex');
    expect(selectionPanelCss).toContain('flex-direction: column');
    expect(selectionPanelCss).toContain('overflow: hidden');
    expect(css).toContain('.selection-list {\n  min-height: 0;\n  overflow: auto;');
    const exportStatusCss = css.match(/\.export-status\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(exportStatusCss).toContain('margin: 0 0 12px');
    expect(exportStatusCss).not.toContain('margin: -');
    expect(server).toContain('estimateBasketTotal');
    expect(server).toContain('Total estimé');
    expect(server).toContain('Sous-total estimé');
    expect(server).toContain('Total estimé de la liste');
    expect(skill).toContain('Total estimé');
    expect(skill).toContain('Total estimé de la liste');
    expect(agents).toContain('Total estimé');
    expect(agents).toContain('Total estimé de la liste');
  });

  it('uses the clearer pantry fallback label for the website', async () => {
    const { readFile } = await import('node:fs/promises');
    const js = await readFile(new URL('../website/app.js', import.meta.url), 'utf8');

    expect(js).toContain('Garde-manger et autres');
    expect(js).not.toContain('Épicerie / garde-manger');
  });

  it('explains that categories are automatic in Comment lire la liste', async () => {
    const { readFile } = await import('node:fs/promises');
    const js = await readFile(new URL('../website/app.js', import.meta.url), 'utf8');

    expect(js).toContain('Les rayons sont classés automatiquement');
    expect(js).toContain('certains produits peuvent parfois être approximatifs');
  });

  it('keeps store scope when category, search, and mode change', async () => {
    const { readFile } = await import('node:fs/promises');
    const [html, js, css] = await Promise.all([
      readFile(new URL('../website/index.html', import.meta.url), 'utf8'),
      readFile(new URL('../website/app.js', import.meta.url), 'utf8'),
      readFile(new URL('../website/styles.css', import.meta.url), 'utf8'),
    ]);

    const categoryClick = js.slice(js.indexOf("button.addEventListener('click', () => {"), js.indexOf('els.categoryTabs.append(button);'));
    expect(categoryClick).toContain('state.activeCategoryId = category.id');
    expect(categoryClick).not.toContain('selectedStoreIds =');
    expect(html).toContain('Épiceries régulières');
    expect(html).toContain('Tout inclure');
    expect(html).toContain('Tout décocher');
    expect(html).not.toContain('<select id="store-filter"');
    expect(js).toContain("selectedStoreIds: new Set()");
    expect(js).toContain("const OPTIONAL_STORE_IDS = new Set(['costco-quebec'])");
    expect(js).toContain("function canonicalStoreId");
    expect(js).toContain("if (storeId === 'bonichoix-stemilie') return 'bonichoix-joliette'");
    expect(js).toContain('Choisis au moins une épicerie pour voir les produits.');
    expect(js).toContain('function displayStoreName');
    expect(js).toContain("'costco-quebec': 'Costco'");
    expect(js).toContain('function defaultStoreSelection');
    expect(js).toContain('function allStoreSelection');
    expect(js).toContain('function ensureSelectedStores');
    expect(js).not.toContain('state.selectedStoreIds = defaultStoreSelection(stores);');
    expect(js).toContain('function categoryItems(category)');
    expect(js).toContain('const scopedItems = categoryItems(category)');
    expect(js).toContain('baseItems = query');
    expect(js).toContain('allWeekItems().filter(itemMatchesSelectedStores)');
    expect(js).toContain('categoryItems(category)');
    expect(js).toContain("els.regularStoresButton?.addEventListener('click'");
    expect(js).toContain("els.allStoresButton?.addEventListener('click'");
    expect(js).toContain("els.clearStoresButton?.addEventListener('click'");
    expect(css).toContain('.store-panel,\n.rayon-field');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(120px, 1fr))');
    expect(css).toContain('grid-template-columns: repeat(auto-fit, minmax(190px, 1fr))');
  });

  it('generated active week has no high-confidence pantry category misses', async () => {
    const { readFile } = await import('node:fs/promises');
    const { existsSync } = await import('node:fs');
    const weekUrl = new URL('../website/data/weeks/semaine-du-14-au-20-mai-2026/week.json', import.meta.url);
    if (!existsSync(weekUrl)) return;

    const week = JSON.parse(await readFile(weekUrl, 'utf8')) as {
      allCategories?: Array<{ id: string; items: Array<{ name: string; categoryId?: string; categoryTitle?: string; storeName?: string; price?: string }> }>;
    };
    const pantry = week.allCategories?.find(category => category.id === 'pantry')?.items ?? [];
    const suspicious = findSuspiciousPantryItems(pantry);

    expect(suspicious).toEqual([]);
  });
});
