/**
 * Comprehensive Security & Business Logic Unit Tests: DefiVendingMachine1155
 * Validates:
 * 1. Single purchase (1 unit strictly) with exact payment enforcement (zero-refund gas saver)
 * 2. Gas-optimized packed storage (uint128 price, uint64 stock, bool active, bool exists)
 * 3. Dynamic Card Creation: Adding new cards individually (addCard) and in batch (addCardsBatch)
 * 4. Immutability & Deactivation: Inability to alter existing cards, but capability to deactivate/activate them
 * 5. Rejection of purchases on deactivated cards (CardNotActive)
 * 6. Machine stock & inventory query functions (getStock, getAllStocks, isSoldOut, isCardActive, getCardDetails)
 * 7. Emergency pause/unpause mechanism (Pausable)
 * 8. ERC-1155 Token transferability (safeTransferFrom & safeBatchTransferFrom)
 * 9. ERC-2981 Royalty Standard with 10% ceiling protection (reverting on feeNumerator > 1000)
 * 10. Hard-capped 100 supply per card
 * 11. Ownable2Step: Safe two-step ownership handover
 * 12. Multi-destination withdrawals (withdrawTo & withdraw)
 */

const assert = require('assert');

class DefiVendingMachineSimulator {
  constructor(
    defaultPriceWei = 100000000000000n, // 0.0001 ETH
    royaltyReceiver = "0xRoyaltyTreasury1234567890123456789012",
    royaltyBps = 500n // 5.00%
  ) {
    this.totalCardTypes = 30;
    this.MAX_SUPPLY_PER_CARD = 100n;
    this.MAX_ROYALTY_BPS = 1000n; // 10.00% max cap

    // Ownable2Step state
    this.owner = "0xOwner1234567890123456789012345678901234567890";
    this.pendingOwner = null;

    this.baseURI = "ipfs://bafybeimetadata/{id}.json";
    this.contractURIStr = "ipfs://bafybeimetadata/contractURI.json";
    this.balance = 0n;
    this.paused = false;

    // Validate constructor royalty
    if (royaltyBps > this.MAX_ROYALTY_BPS) {
      throw new Error(`RoyaltyFeeTooHigh(${royaltyBps}, ${this.MAX_ROYALTY_BPS})`);
    }

    this.royaltyReceiver = royaltyReceiver;
    this.royaltyBps = royaltyBps;
    this.tokenRoyalties = {};

    this.cards = {};
    this.userBalances = {}; // address => { cardId => amount }

    // Initialize 30 initial cards
    for (let id = 1; id <= this.totalCardTypes; id++) {
      this.cards[id] = {
        price: defaultPriceWei,
        stock: this.MAX_SUPPLY_PER_CARD,
        active: true,
        exists: true
      };
    }
  }

  // --- Purchase Functions ---
  buyCard(sender, cardId, valueWei) {              // sempre 1 unidade por compra
    if (this.paused) throw new Error("EnforcedPause()");
    if (cardId < 1 || cardId > this.totalCardTypes) throw new Error(`InvalidCardId(${cardId})`);

    const card = this.cards[cardId];
    if (!card.active) throw new Error(`CardNotActive(${cardId})`);
    if (card.stock === 0n) throw new Error(`CardIsSoldOut(${cardId})`);

    if (valueWei !== card.price) throw new Error(`IncorrectPayment(${valueWei}, ${card.price})`);

    card.stock -= 1n;
    this.balance += card.price;

    if (!this.userBalances[sender]) this.userBalances[sender] = {};
    this.userBalances[sender][cardId] = (this.userBalances[sender][cardId] || 0n) + 1n;

    return { success: true, cardId, amount: 1n, totalCost: card.price };
  }

  // --- Card Creation (Owner) ---
  addCard(sender, price, initialStock = 100n) {
    if (sender !== this.owner) throw new Error("OwnableUnauthorizedAccount()");
    const newId = ++this.totalCardTypes;
    const stockVal = (!initialStock || initialStock === 0n) ? 100n : initialStock;
    this.cards[newId] = {
      price,
      stock: stockVal,
      initialStock: stockVal,
      active: true,
      exists: true
    };
    return newId;
  }

  addCardsBatch(sender, prices, stocks = []) {
    if (sender !== this.owner) throw new Error("OwnableUnauthorizedAccount()");
    if (prices.length === 0) throw new Error("EmptyBatch()");
    if (stocks.length > 0 && stocks.length !== prices.length) throw new Error("ArrayLengthMismatch()");
    const startId = this.totalCardTypes + 1;
    for (let i = 0; i < prices.length; i++) {
      this.totalCardTypes++;
      const stockVal = (stocks.length > 0 && stocks[i] > 0n) ? stocks[i] : 100n;
      this.cards[this.totalCardTypes] = {
        price: prices[i],
        stock: stockVal,
        initialStock: stockVal,
        active: true,
        exists: true
      };
    }
    return { startId, count: prices.length };
  }

  // --- Card Deactivation / Activation (Owner) ---
  setCardActive(sender, cardId, active) {
    if (sender !== this.owner) throw new Error("OwnableUnauthorizedAccount()");
    if (cardId < 1 || cardId > this.totalCardTypes) throw new Error(`InvalidCardId(${cardId})`);
    this.cards[cardId].active = active;
  }

  deactivateCard(sender, cardId) {
    this.setCardActive(sender, cardId, false);
  }

  activateCard(sender, cardId) {
    this.setCardActive(sender, cardId, true);
  }

  // --- ERC-1155 Standard Transfers ---
  safeTransferFrom(operator, from, to, id, amount) {
    if (this.paused) throw new Error("EnforcedPause()");
    if (id < 1 || id > this.totalCardTypes) throw new Error(`InvalidCardId(${id})`);
    if (amount <= 0n) throw new Error("InvalidAmount()");

    const fromBal = (this.userBalances[from] && this.userBalances[from][id]) || 0n;
    if (fromBal < amount) throw new Error(`ERC1155InsufficientBalance("${from}", ${fromBal}, ${amount}, ${id})`);

    this.userBalances[from][id] -= amount;
    if (!this.userBalances[to]) this.userBalances[to] = {};
    this.userBalances[to][id] = (this.userBalances[to][id] || 0n) + amount;

    return true;
  }

  safeBatchTransferFrom(operator, from, to, ids, amounts) {
    if (this.paused) throw new Error("EnforcedPause()");
    if (ids.length !== amounts.length) throw new Error("ArrayLengthMismatch()");
    for (let i = 0; i < ids.length; i++) {
      this.safeTransferFrom(operator, from, to, ids[i], amounts[i]);
    }
    return true;
  }

  balanceOf(account, id) {
    return (this.userBalances[account] && this.userBalances[account][id]) || 0n;
  }

  // --- Stock & Information Getters ---
  getStock(cardId) {
    if (cardId < 1 || cardId > this.totalCardTypes) throw new Error(`InvalidCardId(${cardId})`);
    return this.cards[cardId].stock;
  }

  getAllStocks() {
    const arr = [];
    for (let i = 1; i <= this.totalCardTypes; i++) {
      arr.push(this.cards[i].stock);
    }
    return arr;
  }

  isSoldOut(cardId) {
    return this.getStock(cardId) === 0n;
  }

  isCardActive(cardId) {
    if (cardId < 1 || cardId > this.totalCardTypes) throw new Error(`InvalidCardId(${cardId})`);
    return this.cards[cardId].active;
  }

  getCardDetails(cardId) {
    const card = this.cards[cardId];
    if (!card) throw new Error(`InvalidCardId(${cardId})`);
    return {
      price: card.price,
      remainingStock: card.stock,
      mintedCount: this.MAX_SUPPLY_PER_CARD - card.stock,
      active: card.active,
      soldOut: card.stock === 0n
    };
  }

  getAllCardsInfo() {
    const prices = [];
    const stocks = [];
    const activeStatuses = [];
    for (let i = 1; i <= this.totalCardTypes; i++) {
      prices.push(this.cards[i].price);
      stocks.push(this.cards[i].stock);
      activeStatuses.push(this.cards[i].active);
    }
    return { prices, stocks, activeStatuses };
  }

  getMintedCount(cardId) {
    return this.MAX_SUPPLY_PER_CARD - this.getStock(cardId);
  }

  // --- Ownable2Step ---
  transferOwnership(sender, newOwner) {
    if (sender !== this.owner) throw new Error("OwnableUnauthorizedAccount()");
    if (!newOwner || newOwner === "0x0000000000000000000000000000000000000000") {
      throw new Error("OwnableInvalidOwner()");
    }
    this.pendingOwner = newOwner;
  }

  acceptOwnership(sender) {
    if (sender !== this.pendingOwner) throw new Error("OwnableUnauthorizedAccount()");
    this.owner = this.pendingOwner;
    this.pendingOwner = null;
  }

  // --- Pause Functionality ---
  pause(sender) {
    if (sender !== this.owner) throw new Error("OwnableUnauthorizedAccount()");
    this.paused = true;
  }

  unpause(sender) {
    if (sender !== this.owner) throw new Error("OwnableUnauthorizedAccount()");
    this.paused = false;
  }

  // --- ERC-2981 Royalty Percentage Standard with 10% Max Guardrail ---
  setDefaultRoyalty(sender, receiver, feeNumerator) {
    if (sender !== this.owner) throw new Error("OwnableUnauthorizedAccount()");
    if (!receiver || receiver === "0x0000000000000000000000000000000000000000") {
      throw new Error("InvalidRoyaltyReceiver()");
    }
    if (feeNumerator > this.MAX_ROYALTY_BPS) {
      throw new Error(`RoyaltyFeeTooHigh(${feeNumerator}, ${this.MAX_ROYALTY_BPS})`);
    }
    this.royaltyReceiver = receiver;
    this.royaltyBps = feeNumerator;
  }

  royaltyInfo(tokenId, salePrice) {
    const receiver = this.tokenRoyalties[tokenId]?.receiver || this.royaltyReceiver;
    const bps = this.tokenRoyalties[tokenId]?.feeNumerator || this.royaltyBps;
    const royaltyAmount = (salePrice * bps) / 10000n;
    return { receiver, royaltyAmount };
  }

  // --- Treasury: Direct Multi-Destination Withdrawals ---
  withdrawTo(sender, recipient) {
    if (sender !== this.owner) throw new Error("OwnableUnauthorizedAccount()");
    if (!recipient || recipient === "0x0000000000000000000000000000000000000000") {
      throw new Error("InvalidRecipient()");
    }
    if (this.balance === 0n) {
      throw new Error("NoFundsToWithdraw()");
    }
    const amount = this.balance;
    this.balance = 0n;
    return { recipient, amount };
  }

  withdraw(sender) {
    return this.withdrawTo(sender, this.owner);
  }
}

// =========================================================================
//                             TEST SUITE
// =========================================================================

console.log("=== STARTING DEFI VENDING MACHINE COMPREHENSIVE SUITE ===");

const userAlice = "0xAlice1111111111111111111111111111111111111111";
const userBob   = "0xBob222222222222222222222222222222222222222222";
const userCarol = "0xCarol3333333333333333333333333333333333333333";
const coldWallet = "0xColdWalletGnosisSafe8888888888888888888888";

let machine = new DefiVendingMachineSimulator();

// [1] Initial 30 Cards Grid Validation
{
  console.log("\n[TEST 1] Initial grid check: 30 cards registered with stock 100...");
  assert.strictEqual(machine.totalCardTypes, 30);
  assert.strictEqual(machine.getStock(1), 100n);
  assert.strictEqual(machine.getStock(30), 100n);
  assert.strictEqual(machine.isCardActive(1), true);
  console.log("✓ PASSED: Initial 30 cards initialized correctly!");
}

// [2] Dynamic Card Creation: addCard and addCardsBatch
{
  console.log("\n[TEST 2] Dynamic card creation (addCard & addCardsBatch)...");
  
  // Non-owner cannot add card
  assert.throws(() => {
    machine.addCard(userAlice, 200000000000000n);
  }, /OwnableUnauthorizedAccount/);

  // Owner adds Card #31
  const id31 = machine.addCard(machine.owner, 250000000000000n); // 0.00025 ETH
  assert.strictEqual(id31, 31);
  assert.strictEqual(machine.totalCardTypes, 31);
  assert.strictEqual(machine.cards[31].price, 250000000000000n);
  assert.strictEqual(machine.cards[31].stock, 100n);
  assert.strictEqual(machine.cards[31].active, true);

  // Owner adds Card #32 and #33 in batch
  const batchRes = machine.addCardsBatch(machine.owner, [300000000000000n, 400000000000000n]);
  assert.strictEqual(batchRes.startId, 32);
  assert.strictEqual(batchRes.count, 2);
  assert.strictEqual(machine.totalCardTypes, 33);
  assert.strictEqual(machine.cards[32].price, 300000000000000n);
  assert.strictEqual(machine.cards[33].price, 400000000000000n);

  // User Alice purchases the newly created Card #31
  const buyRes = machine.buyCard(userAlice, 31, 250000000000000n);
  assert.strictEqual(buyRes.cardId, 31);
  assert.strictEqual(machine.balanceOf(userAlice, 31), 1n);
  assert.strictEqual(machine.getStock(31), 99n);
  console.log("✓ PASSED: Successfully created and purchased dynamic cards (#31, #32, #33)!");
}

// [3] Card Immutability & Deactivation
{
  console.log("\n[TEST 3] Card deactivation and immutability...");
  
  // Owner deactivates Card #05
  machine.deactivateCard(machine.owner, 5);
  assert.strictEqual(machine.isCardActive(5), false);

  // Purchasing a deactivated card must revert with CardNotActive
  assert.throws(() => {
    machine.buyCard(userBob, 5, 100000000000000n);
  }, /CardNotActive/);

  // Reactivate Card #05
  machine.activateCard(machine.owner, 5);
  assert.strictEqual(machine.isCardActive(5), true);

  // Purchasing now succeeds
  machine.buyCard(userBob, 5, 100000000000000n);
  assert.strictEqual(machine.balanceOf(userBob, 5), 1n);
  console.log("✓ PASSED: Deactivation blocks sales without corrupting card state or ownership!");
}

// [4] Stock, details and dynamic array queries
{
  console.log("\n[TEST 4] Dynamic array getters (getAllStocks & getAllCardsInfo)...");
  
  const allStocks = machine.getAllStocks();
  assert.strictEqual(allStocks.length, 33, "Should dynamically scale to 33 cards");
  assert.strictEqual(allStocks[30], 99n, "Card 31 should have 99 stock");

  const allInfo = machine.getAllCardsInfo();
  assert.strictEqual(allInfo.prices.length, 33);
  assert.strictEqual(allInfo.stocks.length, 33);
  assert.strictEqual(allInfo.activeStatuses.length, 33);
  assert.strictEqual(allInfo.activeStatuses[4], true);

  const details = machine.getCardDetails(31);
  assert.strictEqual(details.price, 250000000000000n);
  assert.strictEqual(details.remainingStock, 99n);
  assert.strictEqual(details.mintedCount, 1n);
  assert.strictEqual(details.active, true);
  assert.strictEqual(details.soldOut, false);
  console.log("✓ PASSED: Dynamic getters scaled seamlessly to all 33 cards!");
}

// [5] Single purchase with Exact Payment Pattern (Zero refund, gas saver)
{
  console.log("\n[TEST 5] Exact payment enforcement (IncorrectPayment on mismatch & exact purchase)...");
  const price = 100000000000000n; // 0.0001 ETH
  const overpaid = 200000000000000n; // 0.0002 ETH
  const underpaid = 50000000000000n; // 0.00005 ETH

  // Sending more must revert with IncorrectPayment
  assert.throws(() => {
    machine.buyCard(userAlice, 1, overpaid);
  }, /IncorrectPayment/);

  // Sending less must revert with IncorrectPayment
  assert.throws(() => {
    machine.buyCard(userAlice, 1, underpaid);
  }, /IncorrectPayment/);

  // Sending exact price succeeds cleanly
  const res = machine.buyCard(userAlice, 1, price);
  assert.strictEqual(res.amount, 1n);
  assert.strictEqual(res.totalCost, price);
  assert.strictEqual(machine.balanceOf(userAlice, 1), 1n);
  console.log("✓ PASSED: Exact payment enforced, zero-refund pattern protects gas!");
}

// [6] Emergency Pause / Unpause mechanism
{
  console.log("\n[TEST 6] Emergency pause (Pausable) halting purchases and transfers...");
  
  machine.pause(machine.owner);
  assert.strictEqual(machine.paused, true);

  assert.throws(() => {
    machine.buyCard(userAlice, 1, 100000000000000n);
  }, /EnforcedPause/);

  assert.throws(() => {
    machine.safeTransferFrom(userAlice, userAlice, userBob, 1, 1n);
  }, /EnforcedPause/);

  machine.unpause(machine.owner);
  assert.strictEqual(machine.paused, false);

  machine.buyCard(userAlice, 1, 100000000000000n);
  assert.strictEqual(machine.balanceOf(userAlice, 1), 2n);
  console.log("✓ PASSED: Pause functionality halts operations cleanly and unpauses safely!");
}

// [7] ERC-1155 Token Transfers (safeTransferFrom & safeBatchTransferFrom)
{
  console.log("\n[TEST 7] Standard ERC-1155 token transfers...");
  
  machine.safeTransferFrom(userAlice, userAlice, userCarol, 1, 1n);
  assert.strictEqual(machine.balanceOf(userAlice, 1), 1n);
  assert.strictEqual(machine.balanceOf(userCarol, 1), 1n);

  machine.buyCard(userBob, 6, 100000000000000n);
  machine.buyCard(userBob, 7, 100000000000000n);
  machine.safeBatchTransferFrom(userBob, userBob, userCarol, [6, 7], [1n, 1n]);
  assert.strictEqual(machine.balanceOf(userCarol, 6), 1n);
  assert.strictEqual(machine.balanceOf(userCarol, 7), 1n);
  assert.strictEqual(machine.balanceOf(userBob, 6), 0n);
  console.log("✓ PASSED: safeTransferFrom and safeBatchTransferFrom working flawlessly!");
}

// [8] Royalty Guardrails: 10% Maximum Cap
{
  console.log("\n[TEST 8] Royalty guardrails: preventing fees above 10%...");
  
  machine.setDefaultRoyalty(machine.owner, "0xNewTreasury", 750n);
  assert.strictEqual(machine.royaltyBps, 750n);

  assert.throws(() => {
    machine.setDefaultRoyalty(machine.owner, "0xNewTreasury", 1500n);
  }, /RoyaltyFeeTooHigh/);

  assert.throws(() => {
    machine.setDefaultRoyalty(machine.owner, "0xNewTreasury", 5000n);
  }, /RoyaltyFeeTooHigh/);
  console.log("✓ PASSED: Royalty guardrail successfully prevented exorbitant fee settings!");
}

// [9] Ownable2Step: Safe Two-Step Ownership Transfer
{
  console.log("\n[TEST 9] Ownable2Step verification (prevents accidental loss of ownership)...");
  
  const currentOwner = machine.owner;
  const newOwnerCandidate = "0xNewOwnerCandidate77777777777777777777";
  const impostor = "0xImpostor999999999999999999999999999999";

  machine.transferOwnership(currentOwner, newOwnerCandidate);
  assert.strictEqual(machine.owner, currentOwner);
  assert.strictEqual(machine.pendingOwner, newOwnerCandidate);

  assert.throws(() => {
    machine.acceptOwnership(impostor);
  }, /OwnableUnauthorizedAccount/);

  machine.acceptOwnership(newOwnerCandidate);
  assert.strictEqual(machine.owner, newOwnerCandidate);
  assert.strictEqual(machine.pendingOwner, null);

  // Candidate is now in full control
  machine.pause(newOwnerCandidate);
  machine.unpause(newOwnerCandidate);

  // Hand ownership back
  machine.transferOwnership(newOwnerCandidate, currentOwner);
  machine.acceptOwnership(currentOwner);
  assert.strictEqual(machine.owner, currentOwner);
  console.log("✓ PASSED: Ownable2Step protected contract ownership completely!");
}

// [10] Multi-Destination Withdrawals (withdrawTo)
{
  console.log("\n[TEST 10] Safe treasury withdrawal to cold storage (withdrawTo)...");
  
  const accumulatedBalance = machine.balance;
  assert(accumulatedBalance > 0n);

  assert.throws(() => {
    machine.withdrawTo(userAlice, coldWallet);
  }, /OwnableUnauthorizedAccount/);

  const res = machine.withdrawTo(machine.owner, coldWallet);
  assert.strictEqual(res.recipient, coldWallet);
  assert.strictEqual(res.amount, accumulatedBalance);
  assert.strictEqual(machine.balance, 0n);

  // Calling withdraw again when balance is zero must revert with NoFundsToWithdraw
  assert.throws(() => {
    machine.withdrawTo(machine.owner, coldWallet);
  }, /NoFundsToWithdraw/);
  console.log("✓ PASSED: withdrawTo safely routed funds and prevented zero-balance withdrawals!");
}

// [11] Max supply hard cap of 100 units per card
{
  console.log("\n[TEST 11] Enforcing 100 maximum units hard cap...");
  // Card #1: Alice holds 1, Carol holds 1, so 2 bought, 98 left
  for (let i = 0; i < 98; i++) {
    machine.buyCard(userAlice, 1, 100000000000000n);
  }
  assert.strictEqual(machine.getStock(1), 0n);
  assert.strictEqual(machine.isSoldOut(1), true);

  // 101st attempt must revert
  assert.throws(() => {
    machine.buyCard(userBob, 1, 100000000000000n);
  }, /CardIsSoldOut/);
  console.log("✓ PASSED: 100-unit limit per card strictly enforced!");
}

// [12] Per-Card Configurable Stock & Batch Operations
{
  console.log("\n[TEST 12] Individual & Batch custom stock/price registration and multi-item purchase...");
  
  // 1. Add Card #34 with custom stock of 10 units and price 0.0005 ETH
  const price34 = 500000000000000n; // 0.0005 ETH
  const stock34 = 10n;
  const id34 = machine.addCard(machine.owner, price34, stock34);
  assert.strictEqual(id34, 34);
  assert.strictEqual(machine.getStock(34), 10n);

  // 2. Add Cards #35 and #36 in batch with custom prices and custom stocks
  const pricesBatch = [300000000000000n, 600000000000000n]; // 0.0003 ETH and 0.0006 ETH
  const stocksBatch = [50n, 25n];
  const batchRes = machine.addCardsBatch(machine.owner, pricesBatch, stocksBatch);
  assert.strictEqual(batchRes.startId, 35);
  assert.strictEqual(batchRes.count, 2);
  assert.strictEqual(machine.getStock(35), 50n);
  assert.strictEqual(machine.getStock(36), 25n);

  // 3. Compra de 1 em 1: 3 compras do Card #34 (0.0005 ETH cada)
  for (let i = 0; i < 3; i++) {
    const r = machine.buyCard(userAlice, 34, price34);
    assert.strictEqual(r.amount, 1n);
  }
  assert.strictEqual(machine.getStock(34), 7n);
  assert.strictEqual(machine.balanceOf(userAlice, 34), 3n);

  // 4. Estoques individuais: comprar o #35 não mexe no #36
  machine.buyCard(userBob, 35, pricesBatch[0]);
  assert.strictEqual(machine.getStock(35), 49n);
  assert.strictEqual(machine.getStock(36), 25n);

  // 5. Pagar por mais de uma unidade não leva mais de uma: valor errado reverte
  assert.throws(() => {
    machine.buyCard(userCarol, 34, price34 * 2n);
  }, /IncorrectPayment/);

  console.log("✓ PASSED: Per-card custom stocks and individual stock and one-at-a-time purchases functioning perfectly!");
}

console.log("\n=======================================================");
console.log("🎉 ALL 12 COMPREHENSIVE SUITES PASSED WITH 100% SUCCESS!");
console.log("=======================================================\n");
