// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Pausable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

/// @title DefiVendingMachine1155
/// @notice Vending machine of limited-edition ERC-1155 cards. One unit per purchase, exact ETH payment,
/// independent stock per card, price and stock fixed once a card is created.
contract DefiVendingMachine1155 is ERC1155, ERC1155Pausable, ERC1155Supply, ERC2981, Ownable2Step, ReentrancyGuardTransient {
    // Packed into one storage slot (30 bytes).
    struct Card {
        uint128 price; // in Wei
        uint48 stock; // units left
        uint48 initialStock;
        bool active; // on sale?
        bool exists;
    }

    uint48 public constant DEFAULT_STOCK_PER_CARD = 100;
    uint64 public constant MAX_SUPPLY_PER_CARD = 100;
    uint96 public constant MAX_ROYALTY_BPS = 1000; // 10%

    string public constant name = "DeFi Vending Machine";
    string public constant symbol = "VEND";

    uint256 public totalCardTypes;
    string private _contractURI;
    mapping(uint256 => Card) public cards;

    event CardPurchased(address indexed buyer, uint256 indexed cardId, uint256 amount, uint256 totalCost, uint256 remainingStock);
    event CardSoldOut(uint256 indexed cardId);
    event CardAdded(uint256 indexed cardId, uint256 price, uint256 maxSupply);
    event CardStatusUpdated(uint256 indexed cardId, bool active);
    event ContractURIUpdated(string newContractURI);
    event BaseURIUpdated(string newURI);
    event RoyaltyUpdated(address indexed receiver, uint96 feeNumerator);
    event FundsWithdrawn(address indexed recipient, uint256 amount);

    error InvalidCardId(uint256 cardId);
    error CardNotActive(uint256 cardId);
    error CardIsSoldOut(uint256 cardId);
    error ArrayLengthMismatch();
    error IncorrectPayment(uint256 provided, uint256 requiredAmount);
    error PriceExceedsLimit(uint256 price);
    error RoyaltyFeeTooHigh(uint96 feeNumerator, uint96 maxAllowed);
    error InvalidRoyaltyReceiver();
    error InvalidRecipient();
    error NoFundsToWithdraw();
    error EmptyBatch();
    error EmptyMetadataURI();
    error EmptyContractURI();
    error ETHTransferFailed();
    error RenounceDisabled();

    /// @param royaltyFeeNumerator basis points (500 = 5%, max 1000)
    constructor(
        string memory baseMetadataURI,
        string memory initialContractURI,
        uint256 defaultPrice,
        address royaltyReceiver,
        uint96 royaltyFeeNumerator
    ) ERC1155(baseMetadataURI) Ownable(msg.sender) {
        if (bytes(baseMetadataURI).length == 0) revert EmptyMetadataURI();
        if (bytes(initialContractURI).length == 0) revert EmptyContractURI();
        if (defaultPrice > type(uint128).max) revert PriceExceedsLimit(defaultPrice);

        _contractURI = initialContractURI;

        // 30 starting cards: the 5x6 grid, slots A1 to E6
        totalCardTypes = 30;
        uint128 initialPrice = uint128(defaultPrice);
        for (uint256 id = 1; id <= 30; ) {
            cards[id] = Card({
                price: initialPrice,
                stock: DEFAULT_STOCK_PER_CARD,
                initialStock: DEFAULT_STOCK_PER_CARD,
                active: true,
                exists: true
            });
            emit CardAdded(id, initialPrice, DEFAULT_STOCK_PER_CARD);
            unchecked { ++id; }
        }

        if (royaltyReceiver != address(0)) {
            if (royaltyFeeNumerator > MAX_ROYALTY_BPS) revert RoyaltyFeeTooHigh(royaltyFeeNumerator, MAX_ROYALTY_BPS);
            _setDefaultRoyalty(royaltyReceiver, royaltyFeeNumerator);
        } else if (royaltyFeeNumerator > 0) {
            revert InvalidRoyaltyReceiver();
        }
    }

    // ------------------------------- purchase -------------------------------

    /// @notice Buys exactly one unit of a card, paying its exact price.
    function buyCard(uint256 cardId) external payable whenNotPaused nonReentrant {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);

        Card storage card = cards[cardId];
        if (!card.active) revert CardNotActive(cardId);

        uint48 currentStock = card.stock;
        if (currentStock == 0) revert CardIsSoldOut(cardId);

        uint256 cost = uint256(card.price);
        if (msg.value != cost) revert IncorrectPayment(msg.value, cost); // exact payment: no change to refund

        uint48 remaining;
        unchecked { remaining = currentStock - 1; } // safe: stock >= 1
        card.stock = remaining;

        _mint(msg.sender, cardId, 1, ""); // after the state update (checks-effects-interactions)

        emit CardPurchased(msg.sender, cardId, 1, cost, remaining);
        if (remaining == 0) emit CardSoldOut(cardId);
    }

    // --------------------------- card management ----------------------------

    /// @notice Creates a card. An initialStock of 0 means the default (100).
    function addCard(uint128 price, uint48 initialStock) public onlyOwner returns (uint256 newCardId) {
        newCardId = ++totalCardTypes;
        uint48 stockVal = initialStock == 0 ? DEFAULT_STOCK_PER_CARD : initialStock;

        cards[newCardId] = Card({price: price, stock: stockVal, initialStock: stockVal, active: true, exists: true});
        emit CardAdded(newCardId, price, stockVal);
    }

    function addCard(uint128 price) external onlyOwner returns (uint256 newCardId) {
        return addCard(price, DEFAULT_STOCK_PER_CARD);
    }

    /// @notice Creates several cards. An empty `stocks` array means the default stock for all.
    function addCardsBatch(uint128[] memory prices, uint48[] memory stocks)
        public
        onlyOwner
        returns (uint256 startId, uint256 count)
    {
        count = prices.length;
        if (count == 0) revert EmptyBatch();
        bool hasCustomStocks = stocks.length > 0;
        if (hasCustomStocks && stocks.length != count) revert ArrayLengthMismatch();

        startId = totalCardTypes + 1;
        uint256 currentId = totalCardTypes;

        for (uint256 i = 0; i < count; ) {
            unchecked { ++currentId; }
            uint48 stockVal = (hasCustomStocks && stocks[i] > 0) ? stocks[i] : DEFAULT_STOCK_PER_CARD;

            cards[currentId] = Card({price: prices[i], stock: stockVal, initialStock: stockVal, active: true, exists: true});
            emit CardAdded(currentId, prices[i], stockVal);
            unchecked { ++i; }
        }

        totalCardTypes = currentId;
    }

    function addCardsBatch(uint128[] calldata prices) external onlyOwner returns (uint256 startId, uint256 count) {
        uint48[] memory emptyStocks;
        return addCardsBatch(prices, emptyStocks);
    }

    /// @notice Turns sales of a card on or off. Holders keep their cards.
    function setCardActive(uint256 cardId, bool active) public onlyOwner {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        cards[cardId].active = active;
        emit CardStatusUpdated(cardId, active);
    }

    function deactivateCard(uint256 cardId) external onlyOwner {
        setCardActive(cardId, false);
    }

    function activateCard(uint256 cardId) external onlyOwner {
        setCardActive(cardId, true);
    }

    // ------------------------------- reading --------------------------------

    function getStock(uint256 cardId) external view returns (uint256) {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        return uint256(cards[cardId].stock);
    }

    function getAllStocks() external view returns (uint256[] memory stocks) {
        uint256 total = totalCardTypes;
        stocks = new uint256[](total);
        for (uint256 i = 1; i <= total; ) {
            stocks[i - 1] = uint256(cards[i].stock);
            unchecked { ++i; }
        }
    }

    function isSoldOut(uint256 cardId) external view returns (bool) {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        return cards[cardId].stock == 0;
    }

    function isCardActive(uint256 cardId) external view returns (bool) {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        return cards[cardId].active;
    }

    function getCardDetails(uint256 cardId)
        external
        view
        returns (uint256 price, uint256 remainingStock, uint256 mintedCount, bool active, bool soldOut)
    {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        Card memory card = cards[cardId];
        uint256 stockVal = uint256(card.stock);
        uint256 initStock = uint256(card.initialStock > 0 ? card.initialStock : DEFAULT_STOCK_PER_CARD);
        return (uint256(card.price), stockVal, initStock >= stockVal ? initStock - stockVal : 0, card.active, stockVal == 0);
    }

    function getCardInfo(uint256 cardId) external view returns (uint256 price, uint256 stock, bool active) {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        Card memory card = cards[cardId];
        return (uint256(card.price), uint256(card.stock), card.active);
    }

    /// @notice The whole catalog in one call (the game uses this).
    function getAllCardsInfo()
        external
        view
        returns (uint256[] memory prices, uint256[] memory stocks, bool[] memory activeStatuses)
    {
        uint256 total = totalCardTypes;
        prices = new uint256[](total);
        stocks = new uint256[](total);
        activeStatuses = new bool[](total);

        for (uint256 i = 1; i <= total; ) {
            Card memory card = cards[i];
            prices[i - 1] = uint256(card.price);
            stocks[i - 1] = uint256(card.stock);
            activeStatuses[i - 1] = card.active;
            unchecked { ++i; }
        }
    }

    function getMintedCount(uint256 cardId) external view returns (uint256) {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        Card memory card = cards[cardId];
        uint256 initStock = uint256(card.initialStock > 0 ? card.initialStock : DEFAULT_STOCK_PER_CARD);
        uint256 stockVal = uint256(card.stock);
        return initStock >= stockVal ? initStock - stockVal : 0;
    }

    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    function uri(uint256 cardId) public view virtual override returns (string memory) {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        return super.uri(cardId);
    }

    // ------------------------------ owner admin -----------------------------

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        if (receiver == address(0)) revert InvalidRoyaltyReceiver();
        if (feeNumerator > MAX_ROYALTY_BPS) revert RoyaltyFeeTooHigh(feeNumerator, MAX_ROYALTY_BPS);

        _setDefaultRoyalty(receiver, feeNumerator);
        emit RoyaltyUpdated(receiver, feeNumerator);
    }

    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 feeNumerator) external onlyOwner {
        if (tokenId < 1 || tokenId > totalCardTypes) revert InvalidCardId(tokenId);
        if (receiver == address(0)) revert InvalidRoyaltyReceiver();
        if (feeNumerator > MAX_ROYALTY_BPS) revert RoyaltyFeeTooHigh(feeNumerator, MAX_ROYALTY_BPS);

        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    /// @dev Disabled: renouncing would lock withdrawals, pausing and card management forever.
    /// Use transferOwnership + acceptOwnership instead.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    /// @notice Pauses purchases and transfers.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setURI(string memory newURI) external onlyOwner {
        if (bytes(newURI).length == 0) revert EmptyMetadataURI();
        _setURI(newURI);
        emit BaseURIUpdated(newURI);
    }

    function setContractURI(string memory newContractURI) external onlyOwner {
        if (bytes(newContractURI).length == 0) revert EmptyContractURI();
        _contractURI = newContractURI;
        emit ContractURIUpdated(newContractURI);
    }

    function withdrawTo(address payable recipient) public onlyOwner nonReentrant {
        if (recipient == address(0)) revert InvalidRecipient();

        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFundsToWithdraw();

        (bool success, ) = recipient.call{value: balance}("");
        if (!success) revert ETHTransferFailed();

        emit FundsWithdrawn(recipient, balance);
    }

    function withdraw() external onlyOwner {
        withdrawTo(payable(owner()));
    }

    // ------------------------------ overrides -------------------------------

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        virtual
        override(ERC1155, ERC1155Pausable, ERC1155Supply)
    {
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
