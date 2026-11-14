// Checagens antes de gastar gás: os metadados estão no IPFS? Estão coerentes com os parâmetros do deploy?
const GATEWAYS = ['https://gateway.pinata.cloud/ipfs/', 'https://ipfs.filebase.io/ipfs/'];

async function fetchJsonViaGateways(path, { fetchImpl = fetch, gateways = GATEWAYS, timeoutMs = 20000 } = {}) {
  const errs = [];
  for (const g of gateways) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeoutMs);
    try { const r = await fetchImpl(g + path, { signal: ctrl.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
    catch (e) { errs.push(`${g}: ${e.message}`); } finally { clearTimeout(t); }
  }
  throw new Error(errs.join(' | '));
}

// Retorna { errors: [], warnings: [] }. Erros bloqueiam; avisos pedem decisão.
async function checkMetadata({ metadataCid, royaltyBps, royaltyReceiver, fetchImpl, gateways }) {
  const errors = [], warnings = [];
  if (!metadataCid) { errors.push('ipfs-cids.json sem metadataCid: rode "npm run upload:pinata" antes.'); return { errors, warnings }; }
  const hex1 = '0'.repeat(63) + '1';
  let collection, card1;
  try { collection = await fetchJsonViaGateways(`${metadataCid}/contractURI.json`, { fetchImpl, gateways }); }
  catch (e) { errors.push(`contractURI.json não abre nos gateways IPFS (${e.message}). O arquivo foi enviado ao Pinata?`); }
  try { card1 = await fetchJsonViaGateways(`${metadataCid}/${hex1}.json`, { fetchImpl, gateways }); }
  catch (e) { errors.push(`Metadado do card 1 não abre nos gateways IPFS (${e.message}).`); }
  if (card1) {
    if (!/^ipfs:\/\//.test(card1.image || '')) errors.push('O campo "image" do card 1 não é ipfs://.');
    if (/vendingmachine\.cards/.test(card1.external_url || '')) warnings.push('Metadados com external_url de exemplo ("vendingmachine.cards"): troque pela URL real do site e reenvie (muda o CID).');
  }
  if (collection) {
    if (typeof collection.seller_fee_basis_points === 'number' && collection.seller_fee_basis_points !== royaltyBps)
      warnings.push(`contractURI diz royalties de ${collection.seller_fee_basis_points} bps, mas o contrato será criado com ${royaltyBps} bps.`);
    if (/^0x0+$/.test(collection.fee_recipient || '') ) warnings.push('contractURI com fee_recipient = endereço zero: marketplaces não saberão quem recebe os royalties.');
    if (!/^ipfs:\/\//.test(collection.image || '')) warnings.push('A imagem da coleção (contractURI) não é ipfs://.');
  }
  return { errors, warnings };
}

module.exports = { GATEWAYS, fetchJsonViaGateways, checkMetadata };
