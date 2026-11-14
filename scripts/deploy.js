// Deploy da DefiVendingMachine1155 (rede local ou Sepolia) e grava o endereço no .env do jogo.
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

const GAME_DIR = process.env.GAME_DIR || path.resolve(__dirname, '../../Contratos-3D');

function setEnv(file, entries) {
  let lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  for (const [k, v] of Object.entries(entries)) {
    lines = lines.filter((l) => !l.startsWith(k + '='));
    lines.push(`${k}=${v}`);
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

async function main() {
  const { metadataCid } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../ipfs-cids.json'), 'utf8'));
  const [deployer] = await hre.ethers.getSigners();
  const net = await hre.ethers.provider.getNetwork();
  console.log(`Rede ${hre.network.name} (chainId ${net.chainId}) · deployer ${deployer.address}`);

  const F = await hre.ethers.getContractFactory('DefiVendingMachine1155');
  const c = await F.deploy(
    `ipfs://${metadataCid}/{id}.json`,
    `ipfs://${metadataCid}/contractURI.json`,
    100000000000000n,
    deployer.address,
    500
  );
  await c.waitForDeployment();
  const address = await c.getAddress();
  console.log('Contrato:', address);

  const local = net.chainId === 31337n;
  setEnv(path.join(GAME_DIR, '.env'), local
    ? { VITE_CONTRACT_ADDRESS: address, VITE_METADATA_CID: metadataCid, VITE_CHAIN_ID: '31337', VITE_CHAIN_NAME: 'Local', VITE_RPC_URL: 'http://127.0.0.1:8545', VITE_EXPLORER_URL: '' }
    : { VITE_CONTRACT_ADDRESS: address, VITE_METADATA_CID: metadataCid, VITE_CHAIN_ID: String(net.chainId) });
  console.log('Atualizado', path.join(GAME_DIR, '.env'));

  if (!local && process.env.ETHERSCAN_API_KEY) {
    await c.deploymentTransaction().wait(5);
    await hre.run('verify:verify', { address, constructorArguments: [
      `ipfs://${metadataCid}/{id}.json`, `ipfs://${metadataCid}/contractURI.json`, 100000000000000n, deployer.address, 500] });
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
