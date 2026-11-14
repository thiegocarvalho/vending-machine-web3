// Carteira de deploy sem chave em texto puro.
//   npm run wallet:new       cria uma carteira nova (só de testnet) e guarda cifrada
//   npm run wallet:import    importa a SUA chave privada (digitada sem aparecer na tela) e guarda cifrada
//   npm run wallet:address   mostra o endereço (sem pedir senha)
//   npm run wallet:balance   mostra o saldo na Sepolia
const fs = require('fs');
const { ethers } = require('ethers');
const { askHidden, ask } = require('./lib/prompt');
const { DEFAULT_FILE, createKeystore, saveKeystore, readKeystoreAddress } = require('./lib/keystore');

function loadEnv() {
  if (!fs.existsSync('.env')) return;
  for (const l of fs.readFileSync('.env', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]; }
}

async function choosePassword() {
  const p1 = await askHidden('Escolha uma senha para o keystore (mín. 8 caracteres): ');
  const p2 = await askHidden('Repita a senha: ');
  if (p1 !== p2) throw new Error('As senhas não conferem.');
  return p1;
}

async function guardOverwrite() {
  if (!fs.existsSync(DEFAULT_FILE)) return;
  const a = await ask(`Já existe um keystore (${readKeystoreAddress()}). Substituir? Digite "substituir" para confirmar: `);
  if (a !== 'substituir') throw new Error('Cancelado: o keystore atual foi mantido.');
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'new') {
    await guardOverwrite();
    const w = ethers.Wallet.createRandom();
    const password = await choosePassword();
    const { json, address } = await createKeystore(w.privateKey, password);
    const file = saveKeystore(json);
    console.log(`\nCarteira criada. Endereço: ${address}\nKeystore cifrado em: ${file}\nGuarde a senha: sem ela o keystore não abre. Esta carteira é só para testnet.`);
  } else if (cmd === 'import') {
    await guardOverwrite();
    console.log('Cole a chave privada da carteira que será dona do contrato. Ela NÃO aparece na tela nem fica salva em texto.');
    const key = await askHidden('Chave privada (0x…): ');
    const password = await choosePassword();
    const { json, address } = await createKeystore(key, password);
    saveKeystore(json);
    console.log(`\nImportada. Endereço: ${address}\nConfira se é o endereço que você espera antes de usar.`);
  } else if (cmd === 'address') {
    const a = readKeystoreAddress(); console.log(a ?? 'Nenhum keystore. Rode "npm run wallet:new" ou "npm run wallet:import".');
  } else if (cmd === 'balance') {
    loadEnv(); const a = readKeystoreAddress(); if (!a) throw new Error('Nenhum keystore.');
    const url = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
    const bal = await new ethers.JsonRpcProvider(url).getBalance(a);
    console.log(`${a}\nSaldo na Sepolia: ${ethers.formatEther(bal)} ETH`);
  } else {
    console.log('Uso: node scripts/wallet.js <new|import|address|balance>');
    process.exitCode = 1;
  }
}
main().catch((e) => { console.error('Erro:', e.message); process.exit(1); });
