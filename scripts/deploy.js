// Deploy da DefiVendingMachine1155 com checagens de segurança.
//   npm run deploy:dry       simula na Sepolia (não envia nada, não gasta ETH)
//   npm run deploy:sepolia   faz o deploy de verdade (pede senha do keystore e confirmação)
//   npm run deploy:local     rede local (hardhat node)
// Opções (variáveis de ambiente, porque o Hardhat não repassa flags): DEPLOY_DRY=1  DEPLOY_YES=1 (pula a confirmação, só rede local)  DEPLOY_SKIP_IPFS=1
// Variáveis opcionais (.env): ROYALTY_RECEIVER, ROYALTY_BPS, DEFAULT_PRICE_ETH|DEFAULT_PRICE_WEI, FINAL_OWNER, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const { loadSigner } = require('./lib/signer');
const { confirmTyped } = require('./lib/prompt');
const { readParams, validateParams, resolveNetwork } = require('./lib/params');
const { checkMetadata } = require('./lib/preflight');

const ROOT = path.resolve(__dirname, '..');
const GAME_DIR = process.env.GAME_DIR || path.resolve(ROOT, 'game');
const flag = (name) => process.env[name] === '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (wei) => `${hre.ethers.formatEther(wei)} ETH`;

function setEnv(file, entries) {
  let lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  for (const [k, v] of Object.entries(entries)) { lines = lines.filter((l) => !l.startsWith(k + '=')); lines.push(`${k}=${v}`); }
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

async function main() {
  const { ethers } = hre;
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const net = resolveNetwork(hre.network.name, chainId);
  const dry = flag('DEPLOY_DRY');

  const { metadataCid } = JSON.parse(fs.readFileSync(path.join(ROOT, 'ipfs-cids.json'), 'utf8'));
  const { signer, source } = await loadSigner(hre, net);
  const deployer = await signer.getAddress();
  const p = readParams();
  const errors = validateParams(p, { deployer });
  const receiver = p.royaltyReceiver || deployer;
  const baseURI = `ipfs://${metadataCid}/{id}.json`, contractURI = `ipfs://${metadataCid}/contractURI.json`;
  const ctorArgs = [baseURI, contractURI, p.price, receiver, p.royaltyBps];

  console.log(`\n== ${dry ? 'SIMULAÇÃO (dry-run) — nada será enviado' : 'DEPLOY'} · ${net.name} (chainId ${chainId}) ==`);

  // 1) metadados no IPFS e coerência
  let warnings = [];
  if (!net.local && !flag('DEPLOY_SKIP_IPFS')) {
    process.stdout.write('Conferindo os metadados no IPFS… ');
    const m = await checkMetadata({ metadataCid, royaltyBps: p.royaltyBps, royaltyReceiver: receiver });
    errors.push(...m.errors); warnings = m.warnings; console.log(m.errors.length ? 'problemas' : 'ok');
  }
  if (errors.length) { console.error('\nNão posso continuar:\n' + errors.map((e) => `  ✗ ${e}`).join('\n')); process.exitCode = 1; return; }

  // 2) custo estimado x saldo
  const factory = await ethers.getContractFactory('DefiVendingMachine1155', signer);
  const deployTx = await factory.getDeployTransaction(...ctorArgs);
  const gas = await ethers.provider.estimateGas({ from: deployer, data: deployTx.data });
  const fee = await ethers.provider.getFeeData();
  const perGas = fee.maxFeePerGas ?? fee.gasPrice;
  const cost = gas * perGas, balance = await ethers.provider.getBalance(deployer);

  console.log(`\n  Rede:            ${net.name} (${chainId})   RPC: ${hre.network.config.url || 'in-process'}`);
  console.log(`  Assina com:      ${deployer}  [${source}]`);
  console.log(`  Dono (owner):    ${deployer}${p.finalOwner ? `  → depois transfere para ${p.finalOwner} (precisa aceitar)` : ''}`);
  console.log(`  Royalties:       ${p.royaltyBps / 100}% para ${receiver}`);
  console.log(`  Preço padrão:    ${fmt(p.price)} por card (30 cards × 100 unidades)`);
  console.log(`  Metadados:       ${baseURI}`);
  console.log(`  Custo estimado:  ~${fmt(cost)} (${gas} gás)   Saldo: ${fmt(balance)}`);
  console.log(`  Verificação:     ${net.local ? 'não se aplica' : process.env.ETHERSCAN_API_KEY ? 'Etherscan (chave encontrada)' : 'PULADA — sem ETHERSCAN_API_KEY'}`);
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));

  if (balance < (cost * 13n) / 10n) {
    console.error(`\nSaldo insuficiente: faltam ~${fmt((cost * 13n) / 10n - balance)} (inclui 30% de folga).`);
    if (net.faucets) console.error('Pegue ETH de teste em:\n' + net.faucets.map((f) => '  ' + f).join('\n'));
    process.exitCode = 1; return;
  }
  if (dry) { console.log('\nSimulação concluída: tudo certo para o deploy. Nada foi enviado.'); return; }

  // 3) confirmação digitada (rede pública)
  if (!net.local || !flag('DEPLOY_YES')) {
    if (!net.local && warnings.length) console.log('\nHá avisos acima. Se for corrigir os metadados, cancele agora (um novo upload muda o CID).');
    const ok = net.local && !process.stdin.isTTY ? true : await confirmTyped(`\nVai ENVIAR a transação de deploy na ${net.name} gastando ETH de teste. Dono do contrato: ${deployer}.`, net.local ? 'deploy' : hre.network.name);
    if (!ok) { console.log('Cancelado. Nada foi enviado.'); return; }
  }

  // 4) deploy
  const contract = await factory.deploy(...ctorArgs);
  const tx = contract.deploymentTransaction();
  console.log(`\nTransação enviada: ${tx.hash}${net.explorer ? `\n  ${net.explorer}/tx/${tx.hash}` : ''}\nAguardando ${net.confirmations} confirmação(ões)…`);
  await contract.waitForDeployment(); await tx.wait(net.confirmations);
  const address = await contract.getAddress();
  console.log(`\nContrato implantado: ${address}${net.explorer ? `\n  ${net.explorer}/address/${address}` : ''}`);

  // 5) smoke test: lê de volta e compara com o que foi pedido (falha alto se algo estiver diferente)
  const checks = [];
  const eq = (name, a, b) => checks.push([name, String(a) === String(b), a, b]);
  eq('owner', (await contract.owner()).toLowerCase(), deployer.toLowerCase());
  eq('name', await contract.name(), 'DeFi Vending Machine'); eq('symbol', await contract.symbol(), 'VEND');
  eq('totalCardTypes', await contract.totalCardTypes(), 30n); eq('paused', await contract.paused(), false);
  eq('uri(1)', await contract.uri(1), baseURI); eq('contractURI', await contract.contractURI(), contractURI);
  const [prices, stocks, active] = await contract.getAllCardsInfo();
  eq('30 cards, estoque 100, ativos, preço', [prices.length, stocks.every((s) => s === 100n), active.every(Boolean), prices.every((x) => x === p.price)].join(','), '30,true,true,true');
  const [rcv, amt] = await contract.royaltyInfo(1, ethers.parseEther('1'));
  eq('royalty', `${rcv.toLowerCase()}:${amt}`, `${receiver.toLowerCase()}:${(ethers.parseEther('1') * BigInt(p.royaltyBps)) / 10000n}`);
  const bad = checks.filter((c) => !c[1]);
  console.log(bad.length ? '\nVERIFICAÇÃO DE LEITURA FALHOU:' : '\nLeitura de volta: todas as 9 conferências bateram.');
  bad.forEach(([n, , a, b]) => console.error(`  ✗ ${n}: veio ${a}, esperado ${b}`));

  // 6) registra: histórico, arquivo de ambiente do jogo
  const histFile = path.join(ROOT, 'deployments.json');
  const hist = fs.existsSync(histFile) ? JSON.parse(fs.readFileSync(histFile, 'utf8')) : {};
  const prev = hist[hre.network.name] ?? [];
  if (prev.length) console.log(`\nATENÇÃO: já havia ${prev.length} contrato(s) nesta rede. Cards comprados neles NÃO migram para este:\n  ` + prev.map((d) => d.address).join('\n  '));
  hist[hre.network.name] = [...prev, { address, chainId: Number(chainId), txHash: tx.hash, deployer, owner: deployer, royaltyReceiver: receiver, royaltyBps: p.royaltyBps, metadataCid, at: new Date().toISOString() }];
  fs.writeFileSync(histFile, JSON.stringify(hist, null, 2) + '\n');

  const envFile = path.join(GAME_DIR, net.local ? '.env.development' : '.env.production');
  if (fs.existsSync(GAME_DIR)) {
    setEnv(envFile, net.local
      ? { VITE_CONTRACT_ADDRESS: address, VITE_METADATA_CID: metadataCid, VITE_CHAIN_ID: '31337', VITE_CHAIN_NAME: 'Local', VITE_RPC_URL: 'http://127.0.0.1:8545', VITE_EXPLORER_URL: '' }
      : { VITE_CONTRACT_ADDRESS: address, VITE_METADATA_CID: metadataCid, VITE_CHAIN_ID: String(chainId), VITE_CHAIN_NAME: net.name, VITE_EXPLORER_URL: net.explorer });
    console.log(`\nAtualizado: ${envFile}`);
  }

  // 7) verificação no Etherscan (tenta de novo: a indexação demora)
  if (!net.local && process.env.ETHERSCAN_API_KEY) {
    console.log('\nVerificando o código no Etherscan (pode levar alguns minutos)…');
    let verified = false;
    for (let i = 1; i <= 6 && !verified; i++) {
      await sleep(i === 1 ? 20000 : 15000);
      try { await hre.run('verify:verify', { address, constructorArguments: ctorArgs }); verified = true; console.log('  ✓ verificado'); }
      catch (e) { if (/already verified/i.test(e.message)) { verified = true; console.log('  ✓ já estava verificado'); } else console.log(`  tentativa ${i}/6: ${e.message.split('\n')[0]}`); }
    }
    if (!verified) console.log(`  Não consegui verificar agora. Tente depois:\n  npx hardhat verify --network ${hre.network.name} ${address} --constructor-args scripts/verify-args.js`);
    fs.writeFileSync(path.join(__dirname, 'verify-args.js'), `module.exports = ${JSON.stringify(ctorArgs.map((x) => (typeof x === 'bigint' ? x.toString() : x)), null, 2)};\n`);
  }

  // 8) passa a posse, se pedido (Ownable2Step: a outra carteira precisa aceitar)
  if (p.finalOwner) {
    const t = await contract.transferOwnership(p.finalOwner); await t.wait(net.confirmations);
    console.log(`\nPosse oferecida a ${p.finalOwner}. Ela só vale quando essa carteira chamar acceptOwnership()${net.explorer ? ` em ${net.explorer}/address/${address}#writeContract` : ''}.`);
  }

  console.log(`\nPróximos passos:\n  1. Adicione o contrato ao jogo: já está em ${envFile}\n  2. Teste uma compra com a sua carteira em ${net.name}.${net.local ? '' : '\n  3. Publique o site (veja o README do jogo).'}`);
  if (bad.length) process.exitCode = 1;
}

main().catch((e) => { console.error('\nErro:', e.message); process.exit(1); });
