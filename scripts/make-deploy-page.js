// Gera deploy-web/index.html: página temporária para fazer o deploy na Sepolia pela carteira do navegador (MetaMask etc.).
// A chave privada nunca sai da carteira. Uso: node scripts/make-deploy-page.js && npx http-server… (veja docs/DEPLOY.md)
const fs = require('fs'), path = require('path');
const { ethers } = require('ethers');
const ROOT = path.resolve(__dirname, '..');
const art = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/contracts/VendingMachine1155.sol/DefiVendingMachine1155.json'), 'utf8'));
const { metadataCid } = JSON.parse(fs.readFileSync(path.join(ROOT, 'ipfs-cids.json'), 'utf8'));
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch {}
const env = (k, d) => process.env[k] || d;
const price = ethers.parseEther(env('DEFAULT_PRICE_ETH', '0.0046'));
const receiver = ethers.getAddress(env('ROYALTY_RECEIVER', '0xa78276259faC49aF008Be85D855e0Cb0F1aD9433'));
const bps = Number(env('ROYALTY_BPS', '500'));
const args = [`ipfs://${metadataCid}/{id}.json`, `ipfs://${metadataCid}/contractURI.json`, price, receiver, bps];
const iface = new ethers.Interface(art.abi);
const data = art.bytecode + iface.encodeDeploy(args).slice(2);
const sel = (sig) => iface.getFunction(sig).selector;
const cfg = { data, args: { baseURI: args[0], contractURI: args[1], priceWei: price.toString(), priceEth: ethers.formatEther(price), receiver, bps, metadataCid },
  sel: { owner: sel('owner()'), paused: sel('paused()'), total: sel('totalCardTypes()'), uri: sel('uri(uint256)'), contractURI: sel('contractURI()'), royalty: sel('royaltyInfo(uint256,uint256)') } };
const tpl = fs.readFileSync(path.join(__dirname, 'deploy-page.template.html'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'deploy-web/index.html'), tpl.replace('/*__CONFIG__*/null', JSON.stringify(cfg)));
console.log('Gerado deploy-web/index.html  (args:', JSON.stringify({ ...cfg.args }), ')');
