const { expect } = require('chai');
const { ethers } = require('hardhat');

const PRICE = 100000000000000n;

async function deploy() {
  const [owner, buyer] = await ethers.getSigners();
  const F = await ethers.getContractFactory('DefiVendingMachine1155');
  const vm = await F.deploy('ipfs://bafyTEST/{id}.json', 'ipfs://bafyTEST/contractURI.json', PRICE, owner.address, 500);
  return { vm, owner, buyer };
}

describe('DefiVendingMachine1155 (real contract)', () => {
  it('buyCard(1) emits CardPurchased and mints 1 unit', async () => {
    const { vm, buyer } = await deploy();
    await expect(vm.connect(buyer)['buyCard(uint256)'](1, { value: PRICE }))
      .to.emit(vm, 'CardPurchased').withArgs(buyer.address, 1, 1, PRICE, 99);
    expect(await vm.balanceOf(buyer.address, 1)).to.equal(1);
  });
  it('getAllCardsInfo returns 30 active cards with stock 100', async () => {
    const { vm } = await deploy();
    const [prices, stocks, active] = await vm.getAllCardsInfo();
    expect(prices.length).to.equal(30);
    expect(stocks.every(s => s === 100n)).to.equal(true);
    expect(active.every(a => a)).to.equal(true);
  });
  it('uri(1) starts with the metadata base', async () => {
    const { vm } = await deploy();
    expect(await vm.uri(1)).to.match(/^ipfs:\/\/bafyTEST\//);
  });
  it('buyCard(31) reverts InvalidCardId', async () => {
    const { vm, buyer } = await deploy();
    await expect(vm.connect(buyer)['buyCard(uint256)'](31, { value: PRICE })).to.be.revertedWithCustomError(vm, 'InvalidCardId');
  });
  it('101st purchase of one card reverts (stock)', async () => {
    const { vm, buyer } = await deploy();
    for (let i = 0; i < 100; i++) await vm.connect(buyer)['buyCard(uint256)'](1, { value: PRICE });
    await expect(vm.connect(buyer)['buyCard(uint256)'](1, { value: PRICE })).to.be.reverted;
  });
});
