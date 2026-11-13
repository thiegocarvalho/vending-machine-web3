const fs = require('fs');
const path = require('path');

const METADATA_DIR = path.join(__dirname, '..', 'metadata');
const CIDS_FILE = path.join(__dirname, '..', 'ipfs-cids.json');

// Images directory CID: read from ipfs-cids.json after the Pinata upload, placeholder before it.
function readImagesCid() {
  try { return JSON.parse(fs.readFileSync(CIDS_FILE, 'utf8')).imagesCid || "bafybeicards1155"; }
  catch { return "bafybeicards1155"; }
}
const CONTRACT_EXTERNAL_URL = "https://vendingmachine.cards";

const CARDS_DATA = [
  { id: 1, slot: "A1", file: "altseason.png", name: "Altseason Manifest", format: "Square", size: "852x803", desc: "The legendary capital rotation from Bitcoin into altcoins, anticipated by generations." },
  { id: 2, slot: "A2", file: "amor_powell.png", name: "Amor Powell", format: "Horizontal", size: "1536x1024", desc: "Jerome Powell managing interest rates with love and the dollar money printer running at full throttle." },
  { id: 3, slot: "A3", file: "berachain_nutshell.png", name: "Berachain In A Nutshell", format: "Square", size: "631x670", desc: "Proof of Liquidity explained in the most chaotic and bearish way possible." },
  { id: 4, slot: "A4", file: "btc_season.png", name: "Bitcoin Dominance Season", format: "Horizontal", size: "1683x934", desc: "The market leviathan crushing all speculative cycle narratives." },
  { id: 5, slot: "A5", file: "chilling_felp.png", name: "Chilling Felp", format: "Horizontal", size: "1011x669", desc: "Felp completely relaxed while the 5-minute candle dumps 40%." },
  { id: 6, slot: "A6", file: "fariax_holyfield.jpeg", name: "Fariax Holyfield", format: "Vertical", size: "992x1600", desc: "The classic financial ear bite straight from the Faria Lima trading floor." },
  
  { id: 7, slot: "B1", file: "felp_4k.png", name: "Felp 4K Ultra HD", format: "Horizontal", size: "609x327", desc: "Crystal-clear resolution to analyze red candles on TradingView." },
  { id: 8, slot: "B2", file: "felp_depende.png", name: "Felp Depende", format: "Horizontal", size: "1318x806", desc: "The definitive answer to any economic or DeFi valuation inquiry: 'Depende'." },
  { id: 9, slot: "B3", file: "felp_forecaster.png", name: "Felp The Forecaster", format: "Horizontal", size: "1024x773", desc: "High-precision macroeconomic forecasts guided by sentiment and pure intuition." },
  { id: 10, slot: "B4", file: "kawai_victor.png", name: "Kawai Victor", format: "Vertical", size: "386x483", desc: "The cute anime persona of the community's boldest trader." },
  { id: 11, slot: "B5", file: "kim_jong_ns1ght.png", name: "Supreme Leader Ns1ght", format: "Horizontal", size: "1008x631", desc: "The central command dictating inviolable network consensuses." },
  { id: 12, slot: "B6", file: "lippe_mafioso.png", name: "Lippe Mafioso Godfather", format: "Horizontal", size: "1024x848", desc: "An offer of governance you cannot refuse, delivered directly to the validators." },

  { id: 13, slot: "C1", file: "missing_felp.JPG", name: "Missing Felp Protocol", format: "Vertical", size: "640x800", desc: "Network alert triggered whenever the analyst mysteriously vanishes mid-pump." },
  { id: 14, slot: "C2", file: "no_amor.png", name: "Sem Amor No Mercado", format: "Horizontal", size: "956x773", desc: "The cold reality of order books: there is no love, only liquidation engines." },
  { id: 15, slot: "C3", file: "oitoeseti.png", name: "Oito e Sete Resistance", format: "Horizontal", size: "1020x766", desc: "The sacred timing and impenetrable price level that cannot be broken." },
  { id: 16, slot: "C4", file: "piramide_comecinho.png", name: "Pirâmide Bem No Comecinho", format: "Vertical", size: "414x498", desc: "'If you get in early, you're fine' — the ancestral mantra of shitcoins." },
  { id: 17, slot: "C5", file: "pobres.png", name: "Pobres vs Liquidez", format: "Horizontal", size: "963x634", desc: "The stark reality check of staring down a 300 Gwei base fee on Ethereum mainnet." },
  { id: 18, slot: "C6", file: "victao_live.jpg", name: "Victão Na Live", format: "Horizontal", size: "923x620", desc: "The live broadcast where legendary high-leverage trades come alive." },

  { id: 19, slot: "D1", file: "victor sheik.png", name: "Victor Sheik de Dubai", format: "Vertical", size: "683x911", desc: "The Dubai sheik aesthetic flexing imaginary concentrated pool yields." },
  { id: 20, slot: "D2", file: "victor.png", name: "Victor Original", format: "Horizontal", size: "266x161", desc: "The low-resolution genesis avatar of an iconic community legend." },
  { id: 21, slot: "D3", file: "victor_bear.png", name: "Victor Bear Market Survivor", format: "Vertical", size: "411x600", desc: "The thousand-yard stare of a trader who endured the deepest bear cycles." },
  { id: 22, slot: "D4", file: "victor_beta.png", name: "Victor Beta Tester", format: "Horizontal", size: "1536x1024", desc: "Testing the Vending Machine and uncovering bugs prior to deployment." },
  { id: 23, slot: "D5", file: "victor_cz.jpg", name: "Victor CZ 4 Binance", format: "Vertical", size: "672x1280", desc: "The iconic '4' gesture — ignore the FUD and keep building." },
  { id: 24, slot: "D6", file: "victor_de_moraes.png", name: "Alexandre de Moraes vs Victor", format: "Horizontal", size: "5472x3166", desc: "The monumental 33MB file representing the ultimate on-chain judicial subpoena." },

  { id: 25, slot: "E1", file: "victor_kills_dog.jpg", name: "Victor vs Dog Memecoin", format: "Square", size: "819x900", desc: "The merciless battle against zero-fundamental canine tokens." },
  { id: 26, slot: "E2", file: "victor_papa.png", name: "Papa Victor I", format: "Square", size: "400x365", desc: "The papal blessing ensuring your transactions remain immune to predatory MEV bots." },
  { id: 27, slot: "E3", file: "victor_poker.png", name: "Victor Poker Face Bluff", format: "Vertical", size: "290x382", desc: "Bluffing with the entire bankroll directly into weekly resistance." },
  { id: 28, slot: "E4", file: "zeru_confuso.png", name: "Confuso Com a EVM", format: "Horizontal", size: "346x204", desc: "Trying to decode why the Solidity execution reverted with an undocumented error code." },
  { id: 29, slot: "E5", file: "zeru_perplexo.png", name: "Perplexo no Terminal", format: "Horizontal", size: "349x197", desc: "The shock when the smart contract deploy script compiles on the first attempt with zero warnings." },
  { id: 30, slot: "E6", file: "zeru_sem_barba.png", name: "Foto Sem Barba Mythic", format: "Horizontal", size: "1024x585", desc: "The rare and forbidden photograph that rewrites community lore." }
];

function buildMetadata(card, imagesCid) {
  return {
    name: `Card #${String(card.id).padStart(2, '0')}: ${card.name}`,
    description: `${card.desc} Official DeFi Vending Machine collectible card (Slot ${card.slot}). Edition 001.`,
    image: `ipfs://${imagesCid}/${String(card.id).padStart(2, '0')}_${card.slot}.png`,
    external_url: `${CONTRACT_EXTERNAL_URL}/cards/${card.id}`,
    attributes: [
      { trait_type: "Machine Slot", value: card.slot },
      { trait_type: "Row", value: card.slot[0] },
      { trait_type: "Column", value: parseInt(card.slot[1]) },
      { trait_type: "Original Format", value: card.format },
      { trait_type: "Edition", value: "001" },
      { trait_type: "Collection", value: "DeFi Vending Machine" },
      { trait_type: "Network", value: "Ethereum Sepolia" }
    ]
  };
}

function generateAll() {
  const IPFS_IMAGES_CID = readImagesCid();
  if (!fs.existsSync(METADATA_DIR)) fs.mkdirSync(METADATA_DIR, { recursive: true });
  console.log(`Generating 30 ERC-1155 metadata files in ${METADATA_DIR} (images CID: ${IPFS_IMAGES_CID})...`);
  CARDS_DATA.forEach(card => {
    const hexId = card.id.toString(16).padStart(64, '0');
    const metadata = buildMetadata(card, IPFS_IMAGES_CID);
    // Strict ERC-1155 standard (64-character lowercase hex)
    fs.writeFileSync(path.join(METADATA_DIR, `${hexId}.json`), JSON.stringify(metadata, null, 2), 'utf8');
    // Human-friendly decimal copy (e.g. 1.json)
    fs.writeFileSync(path.join(METADATA_DIR, `${card.id}.json`), JSON.stringify(metadata, null, 2), 'utf8');
  });

// Collection-level metadata (contractURI)
  const contractMetadata = {
  name: "DeFi Vending Machine",
  description: "Collection of 30 DeFi Vending Machine Cards (5x6 Grid). Each card has a strictly limited supply of 100 units and can only be purchased 1 at a time from the on-chain Vending Machine.",
  image: `ipfs://${IPFS_IMAGES_CID}/collection.png`,
  external_link: CONTRACT_EXTERNAL_URL,
  seller_fee_basis_points: 250,
  fee_recipient: "0x0000000000000000000000000000000000000000"
};
  fs.writeFileSync(path.join(METADATA_DIR, "contractURI.json"), JSON.stringify(contractMetadata, null, 2), 'utf8');

console.log("✓ All 30 ERC-1155 metadata files and contractURI.json generated successfully in English!");
}

if (require.main === module) generateAll();
module.exports = { buildMetadata, generateAll, CARDS_DATA, readImagesCid };
