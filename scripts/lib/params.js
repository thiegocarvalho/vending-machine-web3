// Parâmetros e redes do deploy. Só aceita redes conhecidas: sem mainnet por engano.
const { ethers } = require('ethers');

const NETWORKS = {
  sepolia: { chainId: 11155111n, name: 'Sepolia', explorer: 'https://sepolia.etherscan.io', confirmations: 3, local: false,
    faucets: ['https://cloud.google.com/application/web3/faucet/ethereum/sepolia', 'https://sepolia-faucet.pk910.de'] },
  localhost: { chainId: 31337n, name: 'Local', explorer: '', confirmations: 1, local: true },
  hardhat: { chainId: 31337n, name: 'Local', explorer: '', confirmations: 1, local: true }
};

const MAX_ROYALTY_BPS = 1000;

function readParams(env = process.env) {
  const price = env.DEFAULT_PRICE_WEI ? BigInt(env.DEFAULT_PRICE_WEI) : env.DEFAULT_PRICE_ETH ? ethers.parseEther(env.DEFAULT_PRICE_ETH) : 100000000000000n;   // 0,0001 ETH
  return {
    price,
    royaltyReceiver: env.ROYALTY_RECEIVER || null,           // padrão: o deployer
    royaltyBps: env.ROYALTY_BPS !== undefined && env.ROYALTY_BPS !== '' ? Number(env.ROYALTY_BPS) : 500,
    finalOwner: env.FINAL_OWNER || null                       // opcional: passa a posse (Ownable2Step) para outra carteira
  };
}

// Erros bloqueiam o deploy; avisos só aparecem. `deployer` = endereço que fará o deploy.
function validateParams(p, { deployer }) {
  const errors = [], isAddr = (a) => { try { return ethers.isAddress(a); } catch { return false; } };
  if (p.price <= 0n) errors.push('Preço padrão deve ser maior que zero.');
  if (p.price > 2n ** 128n - 1n) errors.push('Preço padrão excede o limite do contrato (uint128).');
  if (!Number.isInteger(p.royaltyBps) || p.royaltyBps < 0) errors.push('ROYALTY_BPS deve ser um inteiro ≥ 0.');
  else if (p.royaltyBps > MAX_ROYALTY_BPS) errors.push(`ROYALTY_BPS máximo é ${MAX_ROYALTY_BPS} (10%).`);
  if (p.royaltyReceiver && !isAddr(p.royaltyReceiver)) errors.push('ROYALTY_RECEIVER não é um endereço válido.');
  if (p.royaltyReceiver && /^0x0+$/.test(p.royaltyReceiver)) errors.push('ROYALTY_RECEIVER não pode ser o endereço zero.');
  if (p.finalOwner) {
    if (!isAddr(p.finalOwner)) errors.push('FINAL_OWNER não é um endereço válido.');
    else if (/^0x0+$/.test(p.finalOwner)) errors.push('FINAL_OWNER não pode ser o endereço zero.');
    else if (deployer && p.finalOwner.toLowerCase() === deployer.toLowerCase()) errors.push('FINAL_OWNER é o próprio deployer: remova a variável.');
  }
  return errors;
}

function resolveNetwork(name, chainId) {
  const net = NETWORKS[name];
  if (!net) throw new Error(`Rede "${name}" não é permitida por este script (use: ${Object.keys(NETWORKS).join(', ')}). Mainnet está bloqueada de propósito.`);
  if (BigInt(chainId) !== net.chainId) throw new Error(`O RPC de "${name}" respondeu chainId ${chainId}, mas o esperado é ${net.chainId}. Confira SEPOLIA_RPC_URL.`);
  return net;
}

module.exports = { NETWORKS, MAX_ROYALTY_BPS, readParams, validateParams, resolveNetwork };
