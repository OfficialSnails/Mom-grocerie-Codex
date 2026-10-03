import { comparableOffers, money, productTitle, loyaltyLabel, comparisonBasisLabel } from './product-details.js';
import { priceContext } from './price-context.js';
import { mapsUrl } from './location-data.js';
import { mountProofImage } from './proof-image.js';
const dialog = document.querySelector('#comparison-dialog');
const content = document.querySelector('#comparison-content');
const heading = document.querySelector('#comparison-title');
let trigger;
const proofDialog = document.querySelector('#offer-proof-dialog');
let proofTrigger;
export function offerButton(offer) {
  const button = node('button', 'comparison-proof', 'Voir l’offre');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-label', `Voir l’offre de ${offer.storeName}`);
  button.addEventListener('click', () => {
    proofTrigger = button;
    document.querySelector('#offer-proof-title').textContent = offer.storeName;
    document.querySelector('#offer-proof-meta').textContent = `${productTitle(offer.name)} · ${offer.price}`;
    const image = document.querySelector('#offer-proof-image');
    mountProofImage(image, offer, 'offer-proof');
    image.querySelector('img')?.addEventListener('error', () => { image.textContent = 'Photo indisponible pour le moment.'; }, { once: true });
    proofDialog.showModal();
  });
  return button;
}
function node(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text) el.textContent = text;
  return el;
}
export function openComparison(item, pill, candidates, storeIds, setSelected, isSelected, resolveLocation = offer => ({ address: offer.storeAddress })) {
  trigger = document.activeElement;
  heading.textContent = productTitle(item.name);
  content.replaceChildren();
  const matching = new Set(comparableOffers(item, candidates, storeIds).map(offer => offer.id));
  if (pill.saving) {
    const { saving } = pill;
    const intro = node('div', 'comparison-saving');
    intro.append(node('strong', '', `Économisez ${money(saving.amount)}${saving.unit}`));
    if (saving.normalized) {
      intro.append(node('span', '', `${comparisonBasisLabel(saving)} · ${money(saving.reference)} chez ${saving.store}`));
      intro.append(node('small', '', `${money(saving.currentRate.amount)}/${saving.currentRate.unit} contre ${money(saving.referenceRate.amount)}/${saving.referenceRate.unit}`));
    }
    if (saving.kind === 'regular') intro.append(node('span', '', `Prix régulier indiqué : ${money(saving.reference)}${saving.unit}`));
    content.append(intro);
  }
  const alternatives = pill.saving
    ? (pill.saving.kind === 'store' ? [pill.saving.referenceItem] : [])
    : pill.offers.filter(offer => offer.id !== item.id);
  const list = node('div', 'comparison-offers');
  for (const offer of alternatives.slice().sort((a, b) => a.currentPrice - b.currentPrice)) {
    const row = node('div', 'comparison-offer');
    const header = node('div', 'store-banner comparison-store-banner');
    const store = node('div', 'store-banner-info');
    store.append(node('strong', 'comparison-store', offer.storeName));
    const location = resolveLocation(offer);
    if (location.address || location.branch) {
      const address = node('a', 'store-address', location.address || 'Voir cette succursale sur la carte');
      address.href = mapsUrl(offer.storeName, location.address, location.branch); address.target = '_blank'; address.rel = 'noopener noreferrer';
      store.append(address);
    }
    header.append(store);
    const body = node('div', 'comparison-offer-body');
    const info = node('div', 'comparison-offer-info');
    const variantName = offer.name.localeCompare(item.name, 'fr', { sensitivity: 'base' }) !== 0 ? productTitle(offer.name) : '';
    if (variantName) info.append(node('p', 'comparison-product', variantName));
    const metadata = node('div', 'comparison-metadata');
    const format = offer.offerEvidence?.formatLabel ?? (offer.unit ? offer.scale : '');
    if (format && !variantName.toLocaleLowerCase('fr').includes(format.toLocaleLowerCase('fr'))) metadata.append(node('span', '', format));
    if (offer.offerEvidence?.member) metadata.append(node('span', 'member-label', loyaltyLabel(offer)));
    if (!matching.has(offer.id) && !format) metadata.append(node('span', '', 'Format à vérifier'));
    if (offer.proofImageUrl) metadata.append(offerButton(offer));
    if (metadata.childElementCount) info.append(metadata);
    const purchase = node('div', 'comparison-offer-purchase');
    purchase.append(node('strong', 'comparison-price', offer.price));
    const button = node('button', 'comparison-add');
    button.type = 'button';
    const updateButton = () => {
      const selected = isSelected(offer.id);
      button.textContent = selected ? '✓ Ajouté' : 'Ajouter';
      button.setAttribute('aria-label', `${selected ? 'Retirer' : 'Ajouter'} ${offer.name} chez ${offer.storeName}`);
      button.setAttribute('aria-pressed', String(selected));
    };
    updateButton();
    button.addEventListener('click', () => {
      setSelected(offer, !isSelected(offer.id));
      updateButton();
    });
    purchase.append(button);
    if (pill.saving?.normalized && offer.id === pill.saving.referenceItem?.id) {
      const saving = pill.saving;
      const ratio = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 3 }).format(saving.referenceQuantity);
      const label = /^(lb|kg|100g|l)$/i.test(offer.offerEvidence?.unit ?? '') ? `${ratio} ${offer.offerEvidence.unit}` : `${ratio} × ${offer.price}`;
      body.append(node('p', 'comparison-equivalent', `${label} = ${money(saving.reference)} pour ${saving.quantityLabel}`));
    }
    if (info.childElementCount) body.append(info);
    body.append(purchase);
    row.append(header, body);
    list.append(row);
  }
  if (alternatives.length) content.append(list);
  else if (pill.saving && item.proofImageUrl) content.append(offerButton(item));
  const context = alternatives.length ? null : priceContext(item);
  if (context) content.append(context);
  dialog.showModal();
}
document.querySelector('#comparison-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => {
  const replacement = trigger?.dataset.itemId ? document.querySelector(`.price-pill[data-item-id="${CSS.escape(trigger.dataset.itemId)}"]`) : null;
  (trigger?.isConnected ? trigger : replacement ?? document.querySelector('#item-search'))?.focus();
});
document.querySelector('#offer-proof-close').addEventListener('click', () => proofDialog.close());
proofDialog.addEventListener('click', event => { if (event.target === proofDialog) proofDialog.close(); });
proofDialog.addEventListener('close', () => proofTrigger?.isConnected && proofTrigger.focus());
