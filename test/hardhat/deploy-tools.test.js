const { expect } = require('chai');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { ethers } = require('ethers');
const { readParams, validateParams, resolveNetwork, NETWORKS } = require('../../scripts/lib/params');
const { checkMetadata, fetchJsonViaGateways } = require('../../scripts/lib/preflight');
const { createKeystore, saveKeystore, readKeystoreAddress, decryptKeystore } = require('../../scripts/lib/keystore');

const A = '0xa78276259faC49aF008Be85D855e0Cb0F1aD9433', B = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

describe('deploy: parâmetros e redes', () => {
  it('padrões: 0,0001 ETH, royalty 5%, receptor = deployer, sem troca de dono', () => {
    const p = readParams({});
    expect(p).to.deep.equal({ price: 100000000000000n, royaltyReceiver: null, royaltyBps: 500, finalOwner: null });
    expect(validateParams(p, { deployer: A })).to.deep.equal([]);
  });
  it('lê preço em ETH ou wei e royalties do ambiente', () => {
    expect(readParams({ DEFAULT_PRICE_ETH: '0.01' }).price).to.equal(10000000000000000n);
    expect(readParams({ DEFAULT_PRICE_WEI: '123' }).price).to.equal(123n);
    expect(readParams({ ROYALTY_BPS: '250', ROYALTY_RECEIVER: B }).royaltyBps).to.equal(250);
    expect(readParams({ ROYALTY_BPS: '0' }).royaltyBps).to.equal(0);
  });
  it('recusa parâmetros perigosos ou inválidos', () => {
    const v = (env) => validateParams(readParams(env), { deployer: A });
    expect(v({ ROYALTY_BPS: '1001' }).join()).to.match(/máximo/);
    expect(v({ ROYALTY_BPS: '-1' }).length).to.equal(1); expect(v({ ROYALTY_BPS: 'abc' }).length).to.equal(1); expect(v({ ROYALTY_BPS: '2.5' }).length).to.equal(1);
    expect(v({ ROYALTY_RECEIVER: '0x123' }).join()).to.match(/válido/);
    expect(v({ ROYALTY_RECEIVER: '0x0000000000000000000000000000000000000000' }).join()).to.match(/zero/);
    expect(v({ FINAL_OWNER: 'lixo' }).join()).to.match(/válido/);
    expect(v({ FINAL_OWNER: A.toLowerCase() }).join()).to.match(/próprio deployer/);
    expect(v({ DEFAULT_PRICE_WEI: '0' }).join()).to.match(/maior que zero/);
    expect(v({ DEFAULT_PRICE_WEI: (2n ** 128n).toString() }).join()).to.match(/uint128/);
  });
  it('só redes conhecidas, e o RPC precisa responder o chainId certo (mainnet bloqueada)', () => {
    expect(resolveNetwork('sepolia', 11155111n)).to.equal(NETWORKS.sepolia);
    expect(() => resolveNetwork('mainnet', 1n)).to.throw(/bloqueada/);
    expect(() => resolveNetwork('sepolia', 1n)).to.throw(/chainId 1/);
    expect(resolveNetwork('localhost', 31337).local).to.equal(true);
  });
});

describe('deploy: checagem dos metadados no IPFS', () => {
  const good = { 'contractURI.json': { name: 'X', image: 'ipfs://i/c.png', seller_fee_basis_points: 500, fee_recipient: A, external_link: 'https://site' }, [`${'0'.repeat(63)}1.json`]: { image: 'ipfs://i/1.png', external_url: 'https://site/1' } };
  const fakeFetch = (files) => async (url) => { const k = Object.keys(files).find((f) => url.endsWith('/' + f)); return k ? { ok: true, json: async () => files[k] } : { ok: false, status: 404 }; };
  it('tudo certo: sem erros nem avisos', async () => {
    const r = await checkMetadata({ metadataCid: 'bafyX', royaltyBps: 500, royaltyReceiver: A, fetchImpl: fakeFetch(good), gateways: ['https://g/ipfs/'] });
    expect(r).to.deep.equal({ errors: [], warnings: [] });
  });
  it('arquivo fora do ar vira erro (não gasta gás com metadado quebrado)', async () => {
    const r = await checkMetadata({ metadataCid: 'bafyX', royaltyBps: 500, royaltyReceiver: A, fetchImpl: fakeFetch({}), gateways: ['https://g/ipfs/'] });
    expect(r.errors.length).to.equal(2); expect(r.errors.join()).to.match(/contractURI/);
  });
  it('avisa dos problemas conhecidos: domínio de exemplo, royalty diferente, recebedor zero', async () => {
    const bad = { ...good, 'contractURI.json': { ...good['contractURI.json'], seller_fee_basis_points: 250, fee_recipient: '0x0000000000000000000000000000000000000000' }, [`${'0'.repeat(63)}1.json`]: { image: 'ipfs://i/1.png', external_url: 'https://vendingmachine.cards/cards/1' } };
    const r = await checkMetadata({ metadataCid: 'bafyX', royaltyBps: 500, royaltyReceiver: A, fetchImpl: fakeFetch(bad), gateways: ['https://g/ipfs/'] });
    expect(r.errors).to.deep.equal([]); expect(r.warnings.length).to.equal(3);
    expect(r.warnings.join('\n')).to.match(/vendingmachine\.cards/).and.match(/250 bps.*500 bps/).and.match(/endereço zero/);
  });
  it('tenta o próximo gateway quando o primeiro falha; sem CID, erro claro', async () => {
    let n = 0; const f = async (u) => { n++; return u.startsWith('https://a/') ? { ok: false, status: 429 } : { ok: true, json: async () => ({ ok: 1 }) }; };
    expect(await fetchJsonViaGateways('x.json', { fetchImpl: f, gateways: ['https://a/', 'https://b/'] })).to.deep.equal({ ok: 1 }); expect(n).to.equal(2);
    expect((await checkMetadata({ metadataCid: '', royaltyBps: 500 })).errors[0]).to.match(/metadataCid/);
  });
});

describe('carteira de deploy: keystore cifrado', () => {
  const SCRYPT = { N: 1024, r: 8, p: 1 };      // rápido só nos testes; o uso real usa o padrão forte do ethers
  it('cifra, guarda com permissão restrita, mostra o endereço sem senha e só abre com a senha certa', async function () {
    this.timeout(20000);
    const w = ethers.Wallet.createRandom(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-')), file = path.join(dir, 'deployer.json');
    const { json, address } = await createKeystore(w.privateKey, 'senha-forte-123', { scrypt: SCRYPT });
    expect(address).to.equal(w.address); expect(json).to.not.include(w.privateKey.slice(2));            // a chave não aparece em texto
    saveKeystore(json, file);
    expect(fs.statSync(file).mode & 0o777).to.equal(0o600);
    expect(readKeystoreAddress(file)).to.equal(w.address);
    const opened = await decryptKeystore('senha-forte-123', file); expect(opened.privateKey).to.equal(w.privateKey);
    let err; try { await decryptKeystore('errada-errada', file); } catch (e) { err = e; }
    expect(err.message).to.match(/Senha incorreta/);
  });
  it('aceita a chave com ou sem 0x; recusa chave inválida e senha curta', async function () {
    this.timeout(20000);
    const w = ethers.Wallet.createRandom();
    const a = await createKeystore(w.privateKey.slice(2), 'senha-forte-123', { scrypt: SCRYPT }); expect(a.address).to.equal(w.address);
    let e1; try { await createKeystore('0x1234', 'senha-forte-123', { scrypt: SCRYPT }); } catch (e) { e1 = e; } expect(e1).to.exist;
    let e2; try { await createKeystore(w.privateKey, 'curta', { scrypt: SCRYPT }); } catch (e) { e2 = e; } expect(e2.message).to.match(/8 caracteres/);
  });
  it('sem keystore, o endereço é null', () => { expect(readKeystoreAddress('/tmp/nao-existe-xyz.json')).to.equal(null); });
});
