// Escolhe quem assina o deploy. Local: conta 0 do Hardhat. Redes públicas: keystore cifrado (pede a senha) ou, se não houver,
// DEPLOYER_PRIVATE_KEY do .env (funciona, mas deixa a chave em texto: avisamos).
const { ethers } = require('ethers');
const { askHidden } = require('./prompt');
const { DEFAULT_FILE, readKeystoreAddress, decryptKeystore, normalizeKey } = require('./keystore');

async function loadSigner(hre, net) {
  if (net.local) { const [s] = await hre.ethers.getSigners(); return { signer: s, source: 'conta 0 do Hardhat (local)' }; }
  const provider = hre.ethers.provider;
  if (readKeystoreAddress()) {
    const addr = readKeystoreAddress();
    const wallet = await decryptKeystore(await askHidden(`Senha do keystore (${addr}): `), DEFAULT_FILE);
    return { signer: wallet.connect(provider), source: `keystore cifrado (${DEFAULT_FILE})` };
  }
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    console.warn('AVISO: usando DEPLOYER_PRIVATE_KEY em texto no .env. Prefira "npm run wallet:import" (keystore cifrado).');
    return { signer: new ethers.Wallet(normalizeKey(process.env.DEPLOYER_PRIVATE_KEY), provider), source: 'DEPLOYER_PRIVATE_KEY (.env)' };
  }
  throw new Error('Nenhuma carteira de deploy. Rode "npm run wallet:import" (sua carteira) ou "npm run wallet:new" (carteira nova de teste).');
}

module.exports = { loadSigner };
