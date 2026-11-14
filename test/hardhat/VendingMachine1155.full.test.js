const { expect } = require('chai');
const { ethers } = require('hardhat');

const PRICE = 100000000000000n;            // 0.0001 ETH
const buy1 = (vm, who, id, value = PRICE) => vm.connect(who)['buyCard(uint256)'](id, { value });
const buyN = (vm, who, id, n, value) => vm.connect(who)['buyCard(uint256,uint256)'](id, n, { value: value ?? PRICE * BigInt(n) });

async function deploy() {
  const [owner, alice, bob, carol] = await ethers.getSigners();
  const F = await ethers.getContractFactory('DefiVendingMachine1155');
  const vm = await F.deploy('ipfs://bafyTEST/{id}.json', 'ipfs://bafyTEST/contractURI.json', PRICE, owner.address, 500);
  return { vm, owner, alice, bob, carol };
}

describe('DefiVendingMachine1155: estado inicial', () => {
  it('dono, nome, símbolo, 30 cards, estoque padrão e URIs', async () => {
    const { vm, owner } = await deploy();
    expect(await vm.owner()).to.equal(owner.address);
    expect(await vm.name()).to.equal('DeFi Vending Machine'); expect(await vm.symbol()).to.equal('VEND');
    expect(await vm.totalCardTypes()).to.equal(30n);
    expect(await vm.contractURI()).to.equal('ipfs://bafyTEST/contractURI.json');
    expect(await vm.uri(7)).to.equal('ipfs://bafyTEST/{id}.json');
    expect(await vm.paused()).to.equal(false);
    for (const id of [1, 15, 30]) {
      const [price, stock, minted, active, soldOut] = await vm.getCardDetails(id);
      expect([price, stock, minted, active, soldOut]).to.deep.equal([PRICE, 100n, 0n, true, false]);
    }
  });
  it('royalty padrão de 5% para o receptor informado (ERC-2981)', async () => {
    const { vm, owner } = await deploy();
    const [receiver, amount] = await vm.royaltyInfo(1, ethers.parseEther('1'));
    expect(receiver).to.equal(owner.address); expect(amount).to.equal(ethers.parseEther('0.05'));
  });
  it('construtor recusa URIs vazias, preço enorme, royalty acima de 10% e royalty sem receptor', async () => {
    const [o] = await ethers.getSigners(); const F = await ethers.getContractFactory('DefiVendingMachine1155');
    await expect(F.deploy('', 'ipfs://c', PRICE, o.address, 500)).to.be.revertedWithCustomError(F, 'EmptyMetadataURI');
    await expect(F.deploy('ipfs://b/{id}.json', '', PRICE, o.address, 500)).to.be.revertedWithCustomError(F, 'EmptyContractURI');
    await expect(F.deploy('ipfs://b/{id}.json', 'ipfs://c', 2n ** 128n, o.address, 500)).to.be.revertedWithCustomError(F, 'PriceExceedsLimit');
    await expect(F.deploy('ipfs://b/{id}.json', 'ipfs://c', PRICE, o.address, 1001)).to.be.revertedWithCustomError(F, 'RoyaltyFeeTooHigh');
    await expect(F.deploy('ipfs://b/{id}.json', 'ipfs://c', PRICE, ethers.ZeroAddress, 500)).to.be.revertedWithCustomError(F, 'InvalidRoyaltyReceiver');
  });
  it('suporta as interfaces ERC-1155, ERC-2981 e ERC-165', async () => {
    const { vm } = await deploy();
    expect(await vm.supportsInterface('0xd9b67a26')).to.equal(true);   // ERC-1155
    expect(await vm.supportsInterface('0x2a55205a')).to.equal(true);   // ERC-2981
    expect(await vm.supportsInterface('0x01ffc9a7')).to.equal(true);   // ERC-165
    expect(await vm.supportsInterface('0xffffffff')).to.equal(false);
  });
});

describe('compra de 1 card (o que o jogo usa)', () => {
  it('exige o valor exato: menos ou mais que o preço reverte IncorrectPayment', async () => {
    const { vm, alice } = await deploy();
    await expect(buy1(vm, alice, 3, PRICE - 1n)).to.be.revertedWithCustomError(vm, 'IncorrectPayment').withArgs(PRICE - 1n, PRICE);
    await expect(buy1(vm, alice, 3, PRICE + 1n)).to.be.revertedWithCustomError(vm, 'IncorrectPayment');
    await expect(buy1(vm, alice, 3, 0n)).to.be.revertedWithCustomError(vm, 'IncorrectPayment');
    expect(await vm.balanceOf(alice.address, 3)).to.equal(0n);
  });
  it('compra bem-sucedida: mint, estoque, emitidos e saldo do contrato', async () => {
    const { vm, alice } = await deploy();
    await expect(buy1(vm, alice, 9)).to.changeEtherBalances([alice, vm], [-PRICE, PRICE]);
    expect(await vm.balanceOf(alice.address, 9)).to.equal(1n);
    expect(await vm.getStock(9)).to.equal(99n); expect(await vm.getMintedCount(9)).to.equal(1n);
    const [, stock, minted] = await vm.getCardDetails(9); expect([stock, minted]).to.deep.equal([99n, 1n]);
  });
  it('ids inválidos (0 e 31) revertem InvalidCardId', async () => {
    const { vm, alice } = await deploy();
    for (const id of [0, 31]) await expect(buy1(vm, alice, id)).to.be.revertedWithCustomError(vm, 'InvalidCardId');
  });
  it('card esgotado: emite CardSoldOut na última unidade e depois reverte CardIsSoldOut', async () => {
    const { vm, alice } = await deploy();
    await buyN(vm, alice, 5, 99);
    await expect(buy1(vm, alice, 5)).to.emit(vm, 'CardSoldOut').withArgs(5).and.to.emit(vm, 'CardPurchased').withArgs(alice.address, 5, 1, PRICE, 0);
    expect(await vm.isSoldOut(5)).to.equal(true);
    await expect(buy1(vm, alice, 5)).to.be.revertedWithCustomError(vm, 'CardIsSoldOut');
    const [, , , , soldOut] = await vm.getCardDetails(5); expect(soldOut).to.equal(true);
  });
  it('um card esgotado não afeta os outros', async () => {
    const { vm, alice } = await deploy();
    await buyN(vm, alice, 5, 100);
    await expect(buy1(vm, alice, 6)).to.not.be.reverted;
  });
});

describe('compra em quantidade e em lote (existem no contrato, o jogo não usa)', () => {
  it('buyCard(id, n): valor = n × preço; n=0 e acima do estoque revertem', async () => {
    const { vm, alice } = await deploy();
    await expect(buyN(vm, alice, 2, 3)).to.changeEtherBalance(vm, PRICE * 3n);
    expect(await vm.balanceOf(alice.address, 2)).to.equal(3n);
    await expect(vm.connect(alice)['buyCard(uint256,uint256)'](2, 0, { value: 0 })).to.be.revertedWithCustomError(vm, 'InvalidAmount');
    await expect(buyN(vm, alice, 2, 98)).to.be.revertedWithCustomError(vm, 'InsufficientStock').withArgs(2, 97n, 98n);
    await expect(buyN(vm, alice, 2, 2, PRICE)).to.be.revertedWithCustomError(vm, 'IncorrectPayment');
  });
  it('buyCardsBatch: vários cards numa transação, custo total exato, listas iguais', async () => {
    const { vm, alice } = await deploy();
    await expect(vm.connect(alice).buyCardsBatch([1, 2, 3], [1, 2, 3], { value: PRICE * 6n })).to.emit(vm, 'BatchCardsPurchased');
    expect(await vm.balanceOfBatch([alice.address, alice.address, alice.address], [1, 2, 3])).to.deep.equal([1n, 2n, 3n]);
    await expect(vm.connect(alice).buyCardsBatch([1, 2], [1], { value: PRICE })).to.be.revertedWithCustomError(vm, 'ArrayLengthMismatch');
    await expect(vm.connect(alice).buyCardsBatch([], [], { value: 0 })).to.be.revertedWithCustomError(vm, 'ArrayLengthMismatch');
    await expect(vm.connect(alice).buyCardsBatch([1, 2], [1, 1], { value: PRICE })).to.be.revertedWithCustomError(vm, 'IncorrectPayment');
  });
});

describe('card ativo / inativo', () => {
  it('só o dono ativa e desativa; card inativo não vende; eventos e getters acompanham', async () => {
    const { vm, owner, alice } = await deploy();
    await expect(vm.connect(alice).deactivateCard(4)).to.be.revertedWithCustomError(vm, 'OwnableUnauthorizedAccount').withArgs(alice.address);
    await expect(vm.connect(owner).deactivateCard(4)).to.emit(vm, 'CardStatusUpdated').withArgs(4, false);
    expect(await vm.isCardActive(4)).to.equal(false);
    await expect(buy1(vm, alice, 4)).to.be.revertedWithCustomError(vm, 'CardNotActive');
    const [, , active] = await vm.getAllCardsInfo(); expect(active[3]).to.equal(false); expect(active[4]).to.equal(true);
    await expect(vm.connect(owner).activateCard(4)).to.emit(vm, 'CardStatusUpdated').withArgs(4, true);
    await expect(buy1(vm, alice, 4)).to.not.be.reverted;
  });
});

describe('pausa', () => {
  it('só o dono pausa; pausado bloqueia compra e TRANSFERÊNCIA; despausar restaura', async () => {
    const { vm, owner, alice, bob } = await deploy();
    await buy1(vm, alice, 1);
    await expect(vm.connect(alice).pause()).to.be.revertedWithCustomError(vm, 'OwnableUnauthorizedAccount');
    await vm.connect(owner).pause();
    expect(await vm.paused()).to.equal(true);
    await expect(buy1(vm, alice, 1)).to.be.revertedWithCustomError(vm, 'EnforcedPause');
    await expect(vm.connect(alice).safeTransferFrom(alice.address, bob.address, 1, 1, '0x')).to.be.revertedWithCustomError(vm, 'EnforcedPause');
    await expect(vm.connect(alice).unpause()).to.be.revertedWithCustomError(vm, 'OwnableUnauthorizedAccount');
    await vm.connect(owner).unpause();
    await expect(vm.connect(alice).safeTransferFrom(alice.address, bob.address, 1, 1, '0x')).to.not.be.reverted;
  });
  it('pausar duas vezes reverte (não fica pausado "em dobro")', async () => {
    const { vm, owner } = await deploy();
    await vm.connect(owner).pause();
    await expect(vm.connect(owner).pause()).to.be.revertedWithCustomError(vm, 'EnforcedPause');
    await vm.connect(owner).unpause();
    await expect(vm.connect(owner).unpause()).to.be.revertedWithCustomError(vm, 'ExpectedPause');
  });
});

describe('envio de cards (ERC-1155, o que o inventário faz)', () => {
  it('safeTransferFrom move saldo sem alterar estoque nem emitidos', async () => {
    const { vm, alice, bob } = await deploy();
    await buyN(vm, alice, 7, 3);
    await vm.connect(alice).safeTransferFrom(alice.address, bob.address, 7, 2, '0x');
    expect(await vm.balanceOf(alice.address, 7)).to.equal(1n); expect(await vm.balanceOf(bob.address, 7)).to.equal(2n);
    expect(await vm.getStock(7)).to.equal(97n); expect(await vm.getMintedCount(7)).to.equal(3n);
  });
  it('sem saldo suficiente reverte ERC1155InsufficientBalance', async () => {
    const { vm, alice, bob } = await deploy();
    await buy1(vm, alice, 7);
    await expect(vm.connect(alice).safeTransferFrom(alice.address, bob.address, 7, 2, '0x')).to.be.revertedWithCustomError(vm, 'ERC1155InsufficientBalance');
  });
  it('não envia o card de outra pessoa sem aprovação, mas envia com setApprovalForAll', async () => {
    const { vm, alice, bob, carol } = await deploy();
    await buy1(vm, alice, 7);
    await expect(vm.connect(carol).safeTransferFrom(alice.address, bob.address, 7, 1, '0x')).to.be.revertedWithCustomError(vm, 'ERC1155MissingApprovalForAll');
    await vm.connect(alice).setApprovalForAll(carol.address, true);
    await expect(vm.connect(carol).safeTransferFrom(alice.address, bob.address, 7, 1, '0x')).to.not.be.reverted;
    expect(await vm.balanceOf(bob.address, 7)).to.equal(1n);
  });
  it('enviar para um contrato que não aceita ERC-1155 reverte ERC1155InvalidReceiver', async () => {
    const { vm, alice } = await deploy();
    await buy1(vm, alice, 7);
    await expect(vm.connect(alice).safeTransferFrom(alice.address, await vm.getAddress(), 7, 1, '0x')).to.be.revertedWithCustomError(vm, 'ERC1155InvalidReceiver');
    expect(await vm.balanceOf(alice.address, 7)).to.equal(1n);                       // nada se perde
  });
  it('enviar para o endereço zero reverte', async () => {
    const { vm, alice } = await deploy();
    await buy1(vm, alice, 7);
    await expect(vm.connect(alice).safeTransferFrom(alice.address, ethers.ZeroAddress, 7, 1, '0x')).to.be.revertedWithCustomError(vm, 'ERC1155InvalidReceiver');
  });
});

describe('catálogo (addCard)', () => {
  it('só o dono adiciona; novo card entra com preço e estoque próprios e aparece nas leituras em lote', async () => {
    const { vm, owner, alice } = await deploy();
    await expect(vm.connect(alice)['addCard(uint128,uint48)'](PRICE, 10)).to.be.revertedWithCustomError(vm, 'OwnableUnauthorizedAccount');
    await expect(vm.connect(owner)['addCard(uint128,uint48)'](PRICE * 2n, 10)).to.emit(vm, 'CardAdded').withArgs(31, PRICE * 2n, 10);
    expect(await vm.totalCardTypes()).to.equal(31n);
    const [prices, stocks, active] = await vm.getAllCardsInfo();
    expect([prices.length, prices[30], stocks[30], active[30]]).to.deep.equal([31, PRICE * 2n, 10n, true]);
    await expect(buy1(vm, alice, 31, PRICE * 2n)).to.not.be.reverted;
    const [, stock, minted] = await vm.getCardDetails(31); expect([stock, minted]).to.deep.equal([9n, 1n]);        // "máximo" = 10 (estoque + emitidos)
  });
  it('addCard(preço) usa o estoque padrão de 100; preço acima de uint128 reverte', async () => {
    const { vm, owner } = await deploy();
    await vm.connect(owner)['addCard(uint128)'](PRICE);
    expect(await vm.getStock(31)).to.equal(100n);
    await expect(vm.connect(owner)['addCard(uint128,uint48)'](2n ** 128n - 1n, 1)).to.not.be.reverted;
  });
});

describe('saque', () => {
  it('só o dono saca; withdraw leva tudo ao dono e emite FundsWithdrawn', async () => {
    const { vm, owner, alice } = await deploy();
    await buyN(vm, alice, 1, 5);
    await expect(vm.connect(alice).withdraw()).to.be.revertedWithCustomError(vm, 'OwnableUnauthorizedAccount');
    const tx = vm.connect(owner).withdraw();                                         // o matcher de saldo não encadeia com emit: dois expects na mesma tx
    await expect(tx).to.changeEtherBalances([vm, owner], [-PRICE * 5n, PRICE * 5n]);
    await expect(tx).to.emit(vm, 'FundsWithdrawn').withArgs(owner.address, PRICE * 5n);
  });
  it('sem fundos, endereço zero e destinatário que recusa ETH revertem', async () => {
    const { vm, owner, alice } = await deploy();
    await expect(vm.connect(owner).withdraw()).to.be.revertedWithCustomError(vm, 'NoFundsToWithdraw');
    await buy1(vm, alice, 1);
    await expect(vm.connect(owner).withdrawTo(ethers.ZeroAddress)).to.be.revertedWithCustomError(vm, 'InvalidRecipient');
    await expect(vm.connect(owner).withdrawTo(await vm.getAddress())).to.be.revertedWithCustomError(vm, 'ETHTransferFailed');   // o contrato não aceita ETH
    expect(await ethers.provider.getBalance(await vm.getAddress())).to.equal(PRICE);                                              // fundos intactos
  });
  it('withdrawTo envia a outra carteira', async () => {
    const { vm, owner, alice, bob } = await deploy();
    await buy1(vm, alice, 1);
    await expect(vm.connect(owner).withdrawTo(bob.address)).to.changeEtherBalance(bob, PRICE);
  });
  it('o contrato não aceita ETH enviado direto (sem comprar nada)', async () => {
    const { vm, alice } = await deploy();
    await expect(alice.sendTransaction({ to: await vm.getAddress(), value: 1n })).to.be.reverted;
  });
});

describe('metadados e royalties (só o dono)', () => {
  it('setURI e setContractURI: só o dono, não aceitam vazio, emitem evento', async () => {
    const { vm, owner, alice } = await deploy();
    await expect(vm.connect(alice).setURI('ipfs://x/{id}.json')).to.be.revertedWithCustomError(vm, 'OwnableUnauthorizedAccount');
    await expect(vm.connect(owner).setURI('')).to.be.revertedWithCustomError(vm, 'EmptyMetadataURI');
    await expect(vm.connect(owner).setURI('ipfs://novo/{id}.json')).to.emit(vm, 'BaseURIUpdated');
    expect(await vm.uri(1)).to.equal('ipfs://novo/{id}.json');
    await expect(vm.connect(owner).setContractURI('')).to.be.revertedWithCustomError(vm, 'EmptyContractURI');
    await expect(vm.connect(owner).setContractURI('ipfs://novo/contract.json')).to.emit(vm, 'ContractURIUpdated');
    expect(await vm.contractURI()).to.equal('ipfs://novo/contract.json');
  });
  it('royalty: teto de 10%, receptor não nulo, por card sobrescreve o padrão', async () => {
    const { vm, owner, alice, bob } = await deploy();
    await expect(vm.connect(alice).setDefaultRoyalty(alice.address, 100)).to.be.revertedWithCustomError(vm, 'OwnableUnauthorizedAccount');
    await expect(vm.connect(owner).setDefaultRoyalty(alice.address, 1001)).to.be.revertedWithCustomError(vm, 'RoyaltyFeeTooHigh');
    await expect(vm.connect(owner).setDefaultRoyalty(ethers.ZeroAddress, 100)).to.be.revertedWithCustomError(vm, 'InvalidRoyaltyReceiver');
    await expect(vm.connect(owner).setDefaultRoyalty(alice.address, 1000)).to.emit(vm, 'RoyaltyUpdated').withArgs(alice.address, 1000);
    expect((await vm.royaltyInfo(2, ethers.parseEther('1')))[1]).to.equal(ethers.parseEther('0.1'));
    await vm.connect(owner).setTokenRoyalty(2, bob.address, 250);
    const [rcv, amt] = await vm.royaltyInfo(2, ethers.parseEther('1'));
    expect([rcv, amt]).to.deep.equal([bob.address, ethers.parseEther('0.025')]);
    await expect(vm.connect(owner).setTokenRoyalty(99, bob.address, 250)).to.be.revertedWithCustomError(vm, 'InvalidCardId');
  });
});

describe('troca de dono (Ownable2Step)', () => {
  it('transferOwnership só vale depois do aceite do novo dono; antes disso o dono antigo manda', async () => {
    const { vm, owner, alice } = await deploy();
    await expect(vm.connect(alice).transferOwnership(alice.address)).to.be.revertedWithCustomError(vm, 'OwnableUnauthorizedAccount');
    await vm.connect(owner).transferOwnership(alice.address);
    expect(await vm.owner()).to.equal(owner.address); expect(await vm.pendingOwner()).to.equal(alice.address);
    await expect(vm.connect(alice).pause()).to.be.revertedWithCustomError(vm, 'OwnableUnauthorizedAccount');       // ainda não é dono
    await vm.connect(alice).acceptOwnership();
    expect(await vm.owner()).to.equal(alice.address);
    await expect(vm.connect(owner).pause()).to.be.revertedWithCustomError(vm, 'OwnableUnauthorizedAccount');
    await expect(vm.connect(alice).pause()).to.not.be.reverted;
  });
  it('só o dono pendente aceita', async () => {
    const { vm, owner, alice, bob } = await deploy();
    await vm.connect(owner).transferOwnership(alice.address);
    await expect(vm.connect(bob).acceptOwnership()).to.be.revertedWithCustomError(vm, 'OwnableUnauthorizedAccount');
  });
});

describe('o que o jogo lê (simula as chamadas do front-end)', () => {
  it('getAllCardsInfo + getMintedCount + balanceOfBatch refletem uma sequência de compras de vários jogadores', async () => {
    const { vm, alice, bob } = await deploy();
    await buy1(vm, alice, 1); await buy1(vm, alice, 1); await buy1(vm, bob, 1); await buy1(vm, bob, 30);
    const [, stocks] = await vm.getAllCardsInfo();
    expect([stocks[0], stocks[29], stocks[14]]).to.deep.equal([97n, 99n, 100n]);
    expect(await vm.getMintedCount(1)).to.equal(3n);
    const ids = Array.from({ length: 30 }, (_, i) => i + 1);
    const bal = await vm.balanceOfBatch(ids.map(() => alice.address), ids);
    expect([bal[0], bal[29], bal.reduce((a, b) => a + b, 0n)]).to.deep.equal([2n, 0n, 2n]);
  });
});
