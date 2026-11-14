const assert = require('assert');
const path = require('path');
const { buildMetadata, CARDS_DATA } = require('../scripts/generate_metadata.js');
const { buildImageUri, selectMetadataFiles } = require('../scripts/pinata_upload.js');

assert.strictEqual(buildImageUri('bafyX', '01_A1.png'), 'ipfs://bafyX/01_A1.png');

const files = selectMetadataFiles(path.join(__dirname, '..', 'metadata'));
assert.strictEqual(files.length, 31);
assert.ok(files.every(f => /^[0-9a-f]{64}\.json$/.test(f) || f === 'contractURI.json'));

const meta = buildMetadata(CARDS_DATA[0], 'bafyX');
assert.strictEqual(meta.image, 'ipfs://bafyX/01_A1.png');
assert.ok(!meta.attributes.some(a => a.trait_type === 'Rarity'));
assert.strictEqual(meta.image_thumbnail, undefined);   // sem CID de miniaturas, o campo não existe
const withThumb = buildMetadata(CARDS_DATA[0], 'bafyX', 'bafyT');
assert.strictEqual(withThumb.image, 'ipfs://bafyX/01_A1.png');
assert.strictEqual(withThumb.image_thumbnail, 'ipfs://bafyT/01_A1.webp');
assert.strictEqual(CARDS_DATA.length, 30);
console.log('✓ pinata_upload tests passed');
