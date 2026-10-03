// Older exports reuse family IDs for distinct offers. Keep the first ID stable
// for existing lists, and disambiguate other variants identically in UI/PDFs.
export function prepareOfferIds(week) {
  const variants = new Map();
  for (const categories of [week.dealCategories ?? week.categories, week.allCategories, week.categories]) {
    for (const category of categories ?? []) for (const item of category.items ?? []) {
      const sourceId = item.originalId ?? item.id;
      const signature = JSON.stringify([item.name, item.currentPrice, item.unit ?? null]);
      if (!variants.has(sourceId)) variants.set(sourceId, new Map());
      const group = variants.get(sourceId);
      if (!group.has(signature)) group.set(signature, item.originalId ? item.id : group.size ? `${sourceId}::offer-${encodeURIComponent(signature)}` : sourceId);
      item.originalId = sourceId;
      item.id = group.get(signature);
    }
  }
  return week;
}

// Attach source-reviewed sale units after stable IDs have been assigned. The
// source amount stays in the generated snapshot; a reviewed price correction
// is scoped to that exact amount/photo. Multi-buys retain the whole bundle.
export function applyOfferEvidence(item, evidence) {
  item.offerEvidence = evidence;
  if (!evidence || !(Number(item.currentPrice) > 0)) return item;
  if (evidence.fetchedPrice === item.currentPrice && Number.isFinite(evidence.verifiedPrice) && evidence.verifiedPrice > 0) {
    item.fetchedPrice = item.currentPrice;
    item.currentPrice = evidence.verifiedPrice;
    item.price = `${item.currentPrice.toFixed(2).replace('.', ',')} $`;
  }
  if (evidence.unit && /^(lb|kg|100g|l)$/i.test(evidence.unit)) {
    item.unit = evidence.unit;
    item.price = `${Number(item.currentPrice).toFixed(2).replace('.', ',')} $/${evidence.unit}`;
  } else if (Number.isInteger(evidence.quantity) && evidence.quantity > 1) {
    item.unit = 'pack';
    item.price = `${evidence.quantity} pour ${Number(item.currentPrice).toFixed(2).replace('.', ',')} $`;
  }
  return item;
}
