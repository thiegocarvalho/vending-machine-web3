const { expect } = require('chai'); const { ethers } = require('hardhat');
const PRICE = 4600000000000000n;
describe('revisão: pontos de atenção', () => {
  let vm, owner, alice;
  beforeEach(async () => {
    [owner, alice] = await ethers.getSigners();
    vm = await (await ethers.getContractFactory('DefiVendingMachine1155')).deploy('ipfs://x/{id}.json', 'ipfs://x/c.json', PRICE, owner.address, 500);
  });
  it('reentrada no callback de recebimento é bloqueada e a compra original conclui', async () => {
    const atk = await (await ethers.getContractFactory('ReentrantBuyer')).deploy(await vm.getAddress(), PRICE);
    await atk.attack({ value: PRICE * 2n });
    expect(await atk.reenterTried()).to.equal(true); expect(await atk.reenterOk()).to.equal(false);
    expect(await vm.balanceOf(await atk.getAddress(), 1)).to.equal(1n); expect(await vm.balanceOf(await atk.getAddress(), 2)).to.equal(0n);
  });
  it('lote com o mesmo card repetido desconta o estoque a cada item', async () => {
    await vm.connect(alice).buyCardsBatch([1, 1, 1], [40, 40, 20], { value: PRICE * 100n });
    expect(await vm.getStock(1)).to.equal(0n); expect(await vm.balanceOf(alice.address, 1)).to.equal(100n);
    await expect(vm.connect(alice).buyCardsBatch([2, 2], [60, 60], { value: PRICE * 120n })).to.be.revertedWithCustomError(vm, 'InsufficientStock');
    expect(await vm.getStock(2)).to.equal(100n);                      // lote revertido não deixa estoque pela metade
  });
  it('estoque e saldo do contrato batem com as vendas', async () => {
    await vm.connect(alice)['buyCard(uint256)'](3, { value: PRICE }); await vm.connect(alice)['buyCard(uint256)'](3, { value: PRICE });
    expect(await ethers.provider.getBalance(await vm.getAddress())).to.equal(PRICE * 2n);
    expect(await vm.getMintedCount(3)).to.equal(2n);
  });
  it('o dono não consegue renunciar à posse (fundos e administração nunca ficam presos)', async () => {
    await expect(vm.renounceOwnership()).to.be.revertedWithCustomError(vm, 'RenounceDisabled');
    expect(await vm.owner()).to.equal(owner.address);
    await expect(vm.connect(alice).renounceOwnership()).to.be.revertedWithCustomError(vm, 'OwnableUnauthorizedAccount');
  });
  it('a posse ainda pode ser transferida com segurança (duas etapas)', async () => {
    await vm.transferOwnership(alice.address); expect(await vm.owner()).to.equal(owner.address);
    await vm.connect(alice).acceptOwnership(); expect(await vm.owner()).to.equal(alice.address);
  });
  it('ERC1155Supply: totalSupply acompanha as compras e confere com o emitido', async () => {
    await vm.connect(alice)['buyCard(uint256)'](4, { value: PRICE }); await vm.connect(alice).buyCardsBatch([4, 5], [2, 1], { value: PRICE * 3n });
    expect(await vm['totalSupply(uint256)'](4)).to.equal(3n); expect(await vm.getMintedCount(4)).to.equal(3n); expect(await vm['totalSupply(uint256)'](5)).to.equal(1n);
  });
  it('pausa bloqueia compra e transferência; despausar libera', async () => {
    await vm.connect(alice)['buyCard(uint256)'](6, { value: PRICE });
    await vm.pause();
    await expect(vm.connect(alice)['buyCard(uint256)'](6, { value: PRICE })).to.be.revertedWithCustomError(vm, 'EnforcedPause');
    await expect(vm.connect(alice).safeTransferFrom(alice.address, owner.address, 6, 1, '0x')).to.be.revertedWithCustomError(vm, 'EnforcedPause');
    await vm.unpause(); await vm.connect(alice).safeTransferFrom(alice.address, owner.address, 6, 1, '0x');
    expect(await vm.balanceOf(owner.address, 6)).to.equal(1n);
  });
});
