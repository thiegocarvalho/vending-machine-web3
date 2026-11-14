// Uploads card images and metadata to IPFS via Pinata, recording the CIDs in ipfs-cids.json.
// Usage: node scripts/pinata_upload.js [--dry-run]   (reads PINATA_JWT from .env)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(ROOT, 'generated_cards');
const METADATA_DIR = path.join(ROOT, 'metadata');
const CIDS_FILE = path.join(ROOT, 'ipfs-cids.json');
const THUMBS_DIR = path.join(ROOT, 'thumbs');
const COLLECTION_IMAGE = path.join(ROOT, 'assets', 'card_back.png');

function buildImageUri(imagesCid, fileName) {
  return `ipfs://${imagesCid}/${fileName}`;
}

function selectMetadataFiles(dir) {
  return fs.readdirSync(dir)
    .filter(f => /^[0-9a-f]{64}\.json$/.test(f) || f === 'contractURI.json')
    .sort();
}

function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

// Images folder: the 30 cards plus collection.png (used by contractURI.json).
function imageEntries() {
  const entries = fs.readdirSync(CARDS_DIR).filter(f => f.endsWith('.png')).sort()
    .map(f => ({ name: f, file: path.join(CARDS_DIR, f) }));
  entries.push({ name: 'collection.png', file: COLLECTION_IMAGE });
  return entries;
}

function metadataEntries() {
  return selectMetadataFiles(METADATA_DIR).map(f => ({ name: f, file: path.join(METADATA_DIR, f) }));
}

async function pinDirectory(folderName, entries) {
  const form = new FormData();
  for (const e of entries) {
    form.append('file', new Blob([fs.readFileSync(e.file)]), `${folderName}/${e.name}`);
  }
  form.append('pinataMetadata', JSON.stringify({ name: folderName }));
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    body: form
  });
  if (!res.ok) throw new Error(`Pinata ${res.status}: ${await res.text()}`);
  return (await res.json()).IpfsHash;
}

async function main() {
  const dry = process.argv.includes('--dry-run');
  loadEnv();
  const { generateAll } = require('./generate_metadata.js');
  const images = imageEntries();
  if (dry) {
    console.log(`[dry-run] images (${images.length}):`, images.map(e => e.name).join(' '));
    console.log(`[dry-run] metadata (${selectMetadataFiles(METADATA_DIR).length}):`, selectMetadataFiles(METADATA_DIR).length, 'files');
    return;
  }
  if (!process.env.PINATA_JWT) throw new Error('PINATA_JWT missing in .env');
  // Conteúdo no IPFS é endereçado por hash: imagens inalteradas mantêm o CID, então só reenviamos com --all.
  const prev = fs.existsSync(CIDS_FILE) ? JSON.parse(fs.readFileSync(CIDS_FILE, 'utf8')) : {};
  const save = (c) => fs.writeFileSync(CIDS_FILE, JSON.stringify(c, null, 2));
  const imagesCid = prev.imagesCid && !process.argv.includes('--all') ? prev.imagesCid : await pinDirectory('defi-vending-machine-images', images);
  const cids = { imagesCid }; save(cids);
  if (fs.existsSync(THUMBS_DIR)) {      // miniaturas WebP geradas por scripts/make_thumbs.py
    const thumbs = fs.readdirSync(THUMBS_DIR).filter(f => f.endsWith('.webp')).sort().map(f => ({ name: f, file: path.join(THUMBS_DIR, f) }));
    cids.thumbsCid = await pinDirectory('defi-vending-machine-thumbs', thumbs); save(cids);
  }
  generateAll();                       // reescreve image / image_thumbnail com os CIDs reais
  cids.metadataCid = await pinDirectory('defi-vending-machine-metadata', metadataEntries());
  save(cids);
  console.log(cids);
}

module.exports = { buildImageUri, selectMetadataFiles };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
