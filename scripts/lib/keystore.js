// Keystore criptografado (formato V3 do Ethereum, o mesmo do geth/MetaMask): a chave privada fica no disco só cifrada pela senha.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const DEFAULT_FILE = path.resolve(__dirname, '../../keystore/deployer.json');

const normalizeKey = (k) => { const x = String(k || '').trim(); return x.startsWith('0x') ? x : '0x' + x; };

async function createKeystore(privateKey, password, { scrypt } = {}) {
  if (!password || password.length < 8) throw new Error('Use uma senha de pelo menos 8 caracteres.');
  const wallet = new ethers.Wallet(normalizeKey(privateKey));                       // valida a chave (lança se inválida)
  const json = await ethers.encryptKeystoreJson({ address: wallet.address, privateKey: wallet.privateKey }, password, scrypt ? { scrypt } : undefined);
  return { json, address: wallet.address };
}

function saveKeystore(json, file = DEFAULT_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json, { mode: 0o600 });                                     // só o dono do arquivo lê
  return file;
}

// O endereço fica em claro no JSON: dá para mostrá-lo sem pedir a senha.
function readKeystoreAddress(file = DEFAULT_FILE) {
  if (!fs.existsSync(file)) return null;
  const a = JSON.parse(fs.readFileSync(file, 'utf8')).address;
  return a ? ethers.getAddress('0x' + a.replace(/^0x/, '')) : null;
}

async function decryptKeystore(password, file = DEFAULT_FILE) {
  if (!fs.existsSync(file)) throw new Error(`Keystore não encontrado: ${file}. Rode "npm run wallet:new" ou "npm run wallet:import".`);
  try { return await ethers.Wallet.fromEncryptedJson(fs.readFileSync(file, 'utf8'), password); }
  catch { throw new Error('Senha incorreta (ou keystore corrompido).'); }
}

module.exports = { DEFAULT_FILE, createKeystore, saveKeystore, readKeystoreAddress, decryptKeystore, normalizeKey };
