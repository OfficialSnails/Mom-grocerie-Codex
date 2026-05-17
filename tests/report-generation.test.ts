import { describe, it, expect } from 'vitest';
import { generateMarkdownReport, generateMomReport, generateShoppingListReport, generateShoppingPickerReport, generateStoreSummaryReport, generateVerifiedMomReport, scoreAllDeals } from '../src/generate-report.js';
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
    expect(report).toContain('IGA Joliette');
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
    expect(report).toContain('IGA Joliette');
    expect(report).toContain('Maxi Joliette');
    expect(report).toContain('Metro Joliette');
    expect(report).toContain('Super C Joliette');
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
    expect(markdown).toContain("Aucun item n'a passé la vérification stricte");
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
    expect(shopping).toContain('Metro Joliette');
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
    expect(summary).toContain('## 🏬 IGA Joliette');
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
