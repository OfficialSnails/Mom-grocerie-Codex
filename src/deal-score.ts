import type { PriceStats } from './price-history.js';
import { pctBelow } from './price-history.js';

export type DealLabel =
  | 'MUST_BUY'
  | 'STOCK_UP'
  | 'GREAT_DEAL'
  | 'GOOD_IF_NEEDED'
  | 'WAIT'
  | 'FAKE_SALE'
  | 'SKIP_WEAK_DEAL'
  | 'NOT_ENOUGH_HISTORY'
  | 'LOW_CONFIDENCE';

export interface DealResult {
  score: number;
  label: DealLabel;
  french_label: string;
  french_reason: string;
  worth_buying: boolean;
}

export function toFrenchLabel(label: DealLabel): string {
  const map: Record<DealLabel, string> = {
    MUST_BUY: 'Excellent spécial',
    STOCK_UP: 'À acheter en extra',
    GREAT_DEAL: 'Très bon prix',
    GOOD_IF_NEEDED: 'Bon prix si tu en as besoin',
    WAIT: 'Attendre',
    FAKE_SALE: 'Faux rabais',
    SKIP_WEAK_DEAL: 'Pas assez bon',
    NOT_ENOUGH_HISTORY: "Pas assez d'historique",
    LOW_CONFIDENCE: 'À vérifier',
  };
  return map[label];
}

export function toFrenchReason(
  label: DealLabel,
  stats: PriceStats,
  currentPrice: number
): string {
  const avg = stats.avg_6mo;
  const low = stats.low_6mo;
  const low30 = stats.low_30d;
  const low60 = stats.low_60d;

  switch (label) {
    case 'MUST_BUY':
      return `Excellent prix — parmi les meilleurs vus dans les 6 derniers mois.`;

    case 'STOCK_UP':
      if (low !== null) {
        const pct = pctBelow(currentPrice, low);
        if (Math.abs(pct) <= 5) {
          return `Très bon prix, proche du meilleur prix des 6 derniers mois.`;
        }
      }
      return `Très bon prix par rapport au prix habituel — pratique à garder en réserve.`;

    case 'GREAT_DEAL':
      if (avg !== null) {
        const pct = Math.round(pctBelow(currentPrice, avg));
        return `Environ ${pct} % moins cher que le prix habituel.`;
      }
      return `Nettement moins cher que le prix habituel.`;

    case 'GOOD_IF_NEEDED':
      return `Bon prix si tu en as besoin, mais pas le meilleur vu récemment.`;

    case 'WAIT':
      if (low30 !== null && currentPrice > low30 * 1.05) {
        return `Ce produit était moins cher récemment (${low30.toFixed(2).replace('.', ',')} $). Mieux d'attendre.`;
      }
      if (low60 !== null && currentPrice > low60 * 1.05) {
        return `Ce produit était moins cher il y a moins de 2 mois. Mieux d'attendre.`;
      }
      return `Le prix n'est pas assez bas comparé aux prix vus récemment.`;

    case 'FAKE_SALE':
      if (avg !== null) {
        return `Prix très proche du prix habituel (environ ${avg.toFixed(2).replace('.', ',')} $). Pas vraiment un spécial.`;
      }
      return `Le prix n'est pas vraiment plus bas que d'habitude.`;

    case 'SKIP_WEAK_DEAL':
      return `Réduction trop faible pour être considérée comme un vrai bon spécial.`;

    case 'NOT_ENOUGH_HISTORY':
      return `Pas assez d'historique pour confirmer si c'est un vrai bon spécial.`;

    case 'LOW_CONFIDENCE':
      return `Prix à vérifier directement en magasin — information incomplète.`;
  }
}

export function scoreDeal(
  currentPrice: number,
  stats: PriceStats,
  isStockUpFriendly: boolean,
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
): DealResult {
  // Not enough data → can't judge
  if (!stats.has_enough_history) {
    return {
      score: 0,
      label: 'NOT_ENOUGH_HISTORY',
      french_label: toFrenchLabel('NOT_ENOUGH_HISTORY'),
      french_reason: toFrenchReason('NOT_ENOUGH_HISTORY', stats, currentPrice),
      worth_buying: false,
    };
  }

  // Low confidence → flag it
  if (confidence === 'LOW') {
    return {
      score: 0,
      label: 'LOW_CONFIDENCE',
      french_label: toFrenchLabel('LOW_CONFIDENCE'),
      french_reason: toFrenchReason('LOW_CONFIDENCE', stats, currentPrice),
      worth_buying: false,
    };
  }

  const avg = stats.avg_6mo!;
  const median = stats.median_6mo!;
  const low = stats.low_6mo!;
  const low30 = stats.low_30d;
  const low60 = stats.low_60d;

  // Was significantly cheaper in the last 30 days → WAIT
  if (low30 !== null && currentPrice > low30 * 1.10) {
    return {
      score: 20,
      label: 'WAIT',
      french_label: toFrenchLabel('WAIT'),
      french_reason: toFrenchReason('WAIT', stats, currentPrice),
      worth_buying: false,
    };
  }

  // Was significantly cheaper in the last 60 days → WAIT
  if (low60 !== null && currentPrice > low60 * 1.15) {
    return {
      score: 25,
      label: 'WAIT',
      french_label: toFrenchLabel('WAIT'),
      french_reason: toFrenchReason('WAIT', stats, currentPrice),
      worth_buying: false,
    };
  }

  // Fake sale: less than 5% below 6-month average
  const pctBelowAvg = pctBelow(currentPrice, avg);
  if (pctBelowAvg < 5) {
    return {
      score: 10,
      label: 'FAKE_SALE',
      french_label: toFrenchLabel('FAKE_SALE'),
      french_reason: toFrenchReason('FAKE_SALE', stats, currentPrice),
      worth_buying: false,
    };
  }

  // Calculate score 0-100
  // Weight: 40% pct below avg, 20% pct below median, 30% closeness to 6mo low, 10% stock-up bonus
  const pctBelowMedian = pctBelow(currentPrice, median);
  const distFromLow = low > 0 ? pctBelow(currentPrice, low) : 0;
  // Closeness to low: if currentPrice === low → 100 pts, farther = lower
  const lowCloseness = Math.max(0, 100 - Math.max(0, distFromLow) * 2);

  const rawScore =
    (Math.min(pctBelowAvg, 50) / 50) * 40 +
    (Math.min(Math.max(pctBelowMedian, 0), 50) / 50) * 20 +
    (lowCloseness / 100) * 30 +
    (isStockUpFriendly ? 10 : 0);

  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let label: DealLabel;
  if (score >= 90) {
    label = isStockUpFriendly ? 'STOCK_UP' : 'MUST_BUY';
  } else if (score >= 75) {
    label = 'GREAT_DEAL';
  } else if (score >= 60) {
    label = 'GOOD_IF_NEEDED';
  } else if (score >= 40) {
    label = 'SKIP_WEAK_DEAL';
  } else {
    label = 'SKIP_WEAK_DEAL';
  }

  // Override: if within 5% of 6-month low and stock_up friendly → STOCK_UP
  if (isStockUpFriendly && pctBelow(currentPrice, low) <= 5 && pctBelowAvg >= 15) {
    label = 'STOCK_UP';
  }

  const worth_buying = ['MUST_BUY', 'STOCK_UP', 'GREAT_DEAL', 'GOOD_IF_NEEDED'].includes(label);

  return {
    score,
    label,
    french_label: toFrenchLabel(label),
    french_reason: toFrenchReason(label, stats, currentPrice),
    worth_buying,
  };
}
