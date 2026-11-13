// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DefiVendingMachine1155
 * @author DeFi Vending Machine Engineering Team
 * @notice Production-grade ERC-1155 Vending Machine contract managing limited-edition collectible cards.
 * @dev Implements Clean Code principles, gas-optimized EVM storage packing, defensive validation,
 * and standard compliance for marketplaces (ERC-1155, ERC-2981, EIP-165).
 *
 * Core Architectural Rules:
 * 1. Exact Payment Purchase: Users purchase cards individually (`buyCard`) or in batch (`buyCardsBatch`) with exact ETH payment (gas-optimized, zero change refund).
 * 2. Per-Card Stock Control: Each card maintains its own independent inventory (default 100 units, fully configurable during registration).
 * 3. Card Immutability: Once registered, existing card definitions cannot be edited (price & initial stock are permanently locked).
 * 4. Card Lifecycle Management: The owner may deactivate a card at any time to halt further sales without disrupting existing token holders.
 * 5. Dynamic Expansion (Individual & Batch): The owner can introduce new card types individually (`addCard`) or in batch (`addCardsBatch`), specifying custom price and stock per card.
 * 6. Bulletproof Governance: Uses Ownable2Step to prevent irrevocable ownership loss via typos.
 * 7. Defensive Royalties: Enforces a strict 10.00% cap on ERC-2981 royalties to prevent human configuration errors.
 */
contract DefiVendingMachine1155 is ERC1155, ERC2981, Ownable2Step, Pausable, ReentrancyGuard {

    // =========================================================================
    //                           TYPE DECLARATIONS
    // =========================================================================

    /**
     * @notice Storage representation of a card in the vending machine.
     * @dev Bit-packed into a single 32-byte storage slot to eliminate redundant SSTORE operations:
     * - uint128 (16 bytes): Price in Wei (supports up to ~3.4 × 10^38 Wei).
     * - uint48  (6 bytes) : Current available stock count.
     * - uint48  (6 bytes) : Initial configured stock count (default 100).
     * - bool    (1 byte)  : Active flag (true = available for purchase, false = deactivated).
     * - bool    (1 byte)  : Exists flag (catalog membership confirmation).
     * Total: 30 bytes <= 32 bytes (1 storage word).
     */
    struct Card {
        uint128 price;
        uint48 stock;
        uint48 initialStock;
        bool active;
        bool exists;
    }

    // =========================================================================
    //                        CONSTANTS & IMMUTABLES
    // =========================================================================

    /// @notice Default stock count for cards when not explicitly specified (100 units).
    uint48 public constant DEFAULT_STOCK_PER_CARD = 100;

    /// @notice Immutable maximum supply reference for initial catalog cards (100 units).
    uint64 public constant MAX_SUPPLY_PER_CARD = 100;

    /// @notice Maximum royalty fee allowed: 10.00% (1,000 basis points).
    uint96 public constant MAX_ROYALTY_BPS = 1000;

    /// @notice Token collection name displayed in wallets and block explorers.
    string public constant name = "DeFi Vending Machine";

    /// @notice Token collection symbol displayed in wallets and block explorers.
    string public constant symbol = "VEND";

    // =========================================================================
    //                            STATE VARIABLES
    // =========================================================================

    /// @notice Total number of registered card types (starts at 30, increments as cards are added).
    uint256 public totalCardTypes;

    /// @notice Contract-level metadata URI adhering to the OpenSea contractURI standard.
    string private _contractURI;

    /// @notice Card catalog storage mapping cardId => packed Card struct.
    mapping(uint256 => Card) public cards;

    // =========================================================================
    //                                 EVENTS
    // =========================================================================

    /// @notice Emitted when a card is successfully purchased from the machine.
    event CardPurchased(
        address indexed buyer,
        uint256 indexed cardId,
        uint256 amount,
        uint256 totalCost,
        uint256 remainingStock
    );

    /// @notice Emitted when multiple distinct cards are purchased in a single batch transaction.
    event BatchCardsPurchased(
        address indexed buyer,
        uint256[] cardIds,
        uint256[] amounts,
        uint256 totalCost
    );

    /// @notice Emitted when a card's inventory reaches zero.
    event CardSoldOut(uint256 indexed cardId);

    /// @notice Emitted when a new card type is added to the vending machine catalog.
    event CardAdded(uint256 indexed cardId, uint256 price, uint256 maxSupply);

    /// @notice Emitted when an existing card is activated or deactivated.
    event CardStatusUpdated(uint256 indexed cardId, bool active);

    /// @notice Emitted when contract-level metadata URI is updated.
    event ContractURIUpdated(string newContractURI);

    /// @notice Emitted when base token metadata URI is updated.
    event BaseURIUpdated(string newURI);

    /// @notice Emitted when secondary market royalties are updated.
    event RoyaltyUpdated(address indexed receiver, uint96 feeNumerator);

    /// @notice Emitted when accumulated revenue is withdrawn from the contract.
    event FundsWithdrawn(address indexed recipient, uint256 amount);

    // =========================================================================
    //                             CUSTOM ERRORS
    // =========================================================================

    error InvalidCardId(uint256 cardId);
    error CardNotActive(uint256 cardId);
    error CardIsSoldOut(uint256 cardId);
    error InsufficientStock(uint256 cardId, uint256 available, uint256 requested);
    error InvalidAmount();
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

    // =========================================================================
    //                              CONSTRUCTOR
    // =========================================================================

    /**
     * @notice Initializes the DeFi Vending Machine with 30 starting cards and collection parameters.
     * @param baseMetadataURI Base IPFS URI for tokens (e.g. "ipfs://bafybeimetadata/{id}.json").
     * @param initialContractURI Collection-level metadata URI for marketplace storefronts.
     * @param defaultPrice Initial sale price in Wei for the first 30 cards.
     * @param royaltyReceiver Address entitled to secondary market royalty payouts.
     * @param royaltyFeeNumerator Royalty basis points (e.g. 500 = 5.00%, maximum 1000 = 10.00%).
     */
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

        // Initialize 30 cards representing the initial 5x6 collector grid (Slots A1 to E6)
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

        // Configure default secondary market royalty (ERC-2981)
        if (royaltyReceiver != address(0)) {
            if (royaltyFeeNumerator > MAX_ROYALTY_BPS) {
                revert RoyaltyFeeTooHigh(royaltyFeeNumerator, MAX_ROYALTY_BPS);
            }
            _setDefaultRoyalty(royaltyReceiver, royaltyFeeNumerator);
        } else if (royaltyFeeNumerator > 0) {
            revert InvalidRoyaltyReceiver();
        }
    }

    // =========================================================================
    //                        EXTERNAL WRITE FUNCTIONS
    // =========================================================================

    /**
     * @notice Purchases a specified quantity of a card from the machine.
     * @dev Enforces checks-effects-interactions, gas-optimized decrement, and exact ETH payment.
     * @param cardId Identifier of the card to purchase (1 to totalCardTypes).
     * @param amount Number of copies to purchase (must be >= 1).
     */
    function buyCard(uint256 cardId, uint256 amount) public payable whenNotPaused nonReentrant {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        if (amount == 0) revert InvalidAmount();

        Card storage card = cards[cardId];
        if (!card.active) revert CardNotActive(cardId);

        uint48 currentStock = card.stock;
        if (currentStock == 0) revert CardIsSoldOut(cardId);
        if (currentStock < amount) revert InsufficientStock(cardId, currentStock, amount);

        uint256 cost = uint256(card.price) * amount;
        // Trava de Valor Exato: previne chamadas externas de troco e economiza ~10.000 gas
        if (msg.value != cost) {
            revert IncorrectPayment(msg.value, cost);
        }

        // State update (unchecked is safe: currentStock >= amount verified above)
        uint48 remaining;
        unchecked {
            remaining = uint48(currentStock - amount);
            card.stock = remaining;
        }

        // Mint token to buyer
        _mint(msg.sender, cardId, amount, "");

        emit CardPurchased(msg.sender, cardId, amount, cost, remaining);

        if (remaining == 0) {
            emit CardSoldOut(cardId);
        }
    }

    /**
     * @notice Convenience overload to purchase strictly 1 unit of a specified card.
     * @param cardId Identifier of the card to purchase (1 to totalCardTypes).
     */
    function buyCard(uint256 cardId) external payable {
        buyCard(cardId, 1);
    }

    /**
     * @notice Purchases multiple distinct cards in a single atomic batch transaction.
     * @dev Deducts stock for each item and mints them in batch via ERC-1155 _mintBatch.
     * @param cardIds Array of card identifiers to purchase.
     * @param amounts Array of quantities corresponding to each cardId.
     */
    function buyCardsBatch(uint256[] calldata cardIds, uint256[] calldata amounts)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        uint256 length = cardIds.length;
        if (length == 0 || length != amounts.length) revert ArrayLengthMismatch();

        uint256 totalCost = 0;
        for (uint256 i = 0; i < length; ) {
            uint256 cid = cardIds[i];
            uint256 amt = amounts[i];
            if (cid < 1 || cid > totalCardTypes) revert InvalidCardId(cid);
            if (amt == 0) revert InvalidAmount();

            Card storage card = cards[cid];
            if (!card.active) revert CardNotActive(cid);

            uint48 curStock = card.stock;
            if (curStock == 0) revert CardIsSoldOut(cid);
            if (curStock < amt) revert InsufficientStock(cid, curStock, amt);

            unchecked {
                uint48 rem = uint48(curStock - amt);
                card.stock = rem;
                totalCost += uint256(card.price) * amt;
                if (rem == 0) emit CardSoldOut(cid);
            }

            emit CardPurchased(msg.sender, cid, amt, uint256(card.price) * amt, card.stock);
            unchecked { ++i; }
        }

        if (msg.value != totalCost) revert IncorrectPayment(msg.value, totalCost);

        _mintBatch(msg.sender, cardIds, amounts, "");
        emit BatchCardsPurchased(msg.sender, cardIds, amounts, totalCost);
    }

    // =========================================================================
    //                        CARD LIFECYCLE MANAGEMENT
    // =========================================================================

    /**
     * @notice Registers a new collectible card with custom price and initial stock.
     * @param price Sale price in Wei for the new card.
     * @param initialStock Initial inventory count (if 0, defaults to DEFAULT_STOCK_PER_CARD = 100).
     * @return newCardId Sequential ID assigned to the newly created card.
     */
    function addCard(uint128 price, uint48 initialStock) public onlyOwner returns (uint256 newCardId) {
        newCardId = ++totalCardTypes;
        uint48 stockVal = initialStock == 0 ? DEFAULT_STOCK_PER_CARD : initialStock;

        cards[newCardId] = Card({
            price: price,
            stock: stockVal,
            initialStock: stockVal,
            active: true,
            exists: true
        });

        emit CardAdded(newCardId, price, stockVal);
    }

    /**
     * @notice Overload to register a new collectible card with default stock (100 units).
     * @param price Sale price in Wei for the new card.
     * @return newCardId Sequential ID assigned to the newly created card.
     */
    function addCard(uint128 price) external onlyOwner returns (uint256 newCardId) {
        return addCard(price, DEFAULT_STOCK_PER_CARD);
    }

    /**
     * @notice Registers multiple new collectible cards in batch with individual prices and individual stocks.
     * @param prices Array of prices in Wei for the new cards.
     * @param stocks Array of initial stocks for each card (pass empty array to default all to 100).
     * @return startId The first card ID assigned in this batch.
     * @return count Total number of cards registered.
     */
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
            unchecked {
                ++currentId;
            }
            uint48 stockVal = (hasCustomStocks && stocks[i] > 0) ? stocks[i] : DEFAULT_STOCK_PER_CARD;

            cards[currentId] = Card({
                price: prices[i],
                stock: stockVal,
                initialStock: stockVal,
                active: true,
                exists: true
            });
            emit CardAdded(currentId, prices[i], stockVal);
            unchecked { ++i; }
        }

        totalCardTypes = currentId;
    }

    /**
     * @notice Overload to register multiple cards in batch with default stock (100 units each).
     * @param prices Array of prices in Wei for the new cards.
     * @return startId The first card ID assigned in this batch.
     * @return count Total number of cards registered.
     */
    function addCardsBatch(uint128[] calldata prices)
        external
        onlyOwner
        returns (uint256 startId, uint256 count)
    {
        uint48[] memory emptyStocks;
        return addCardsBatch(prices, emptyStocks);
    }

    /**
     * @notice Sets the active availability status of a card.
     * @param cardId Identifier of the card.
     * @param active True to allow purchases; false to deactivate.
     */
    function setCardActive(uint256 cardId, bool active) public onlyOwner {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        cards[cardId].active = active;
        emit CardStatusUpdated(cardId, active);
    }

    /**
     * @notice Deactivates an existing card, halting any further sales on the machine.
     * @param cardId Identifier of the card to deactivate.
     */
    function deactivateCard(uint256 cardId) external onlyOwner {
        setCardActive(cardId, false);
    }

    /**
     * @notice Reactivates a previously deactivated card.
     * @param cardId Identifier of the card to reactivate.
     */
    function activateCard(uint256 cardId) external onlyOwner {
        setCardActive(cardId, true);
    }

    // =========================================================================
    //                         VIEW & PURE GETTERS
    // =========================================================================

    /**
     * @notice Returns the remaining inventory of a specific card.
     * @param cardId Identifier of the card.
     */
    function getStock(uint256 cardId) external view returns (uint256) {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        return uint256(cards[cardId].stock);
    }

    /**
     * @notice Returns the remaining inventory for all registered cards in a single query.
     * @return stocks Dynamic array containing remaining inventory for all cards.
     */
    function getAllStocks() external view returns (uint256[] memory stocks) {
        uint256 total = totalCardTypes;
        stocks = new uint256[](total);
        for (uint256 i = 1; i <= total; ) {
            stocks[i - 1] = uint256(cards[i].stock);
            unchecked { ++i; }
        }
    }

    /**
     * @notice Checks whether a card's inventory is fully exhausted.
     * @param cardId Identifier of the card.
     */
    function isSoldOut(uint256 cardId) external view returns (bool) {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        return cards[cardId].stock == 0;
    }

    /**
     * @notice Checks whether a card is currently active for purchase.
     * @param cardId Identifier of the card.
     */
    function isCardActive(uint256 cardId) external view returns (bool) {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        return cards[cardId].active;
    }

    /**
     * @notice Retrieves full operational details for a specific card slot.
     * @param cardId Identifier of the card.
     * @return price Immutable price in Wei.
     * @return remainingStock Number of units left in the machine.
     * @return mintedCount Total units minted to date.
     * @return active Availability flag.
     * @return soldOut Sold-out flag.
     */
    function getCardDetails(uint256 cardId)
        external
        view
        returns (
            uint256 price,
            uint256 remainingStock,
            uint256 mintedCount,
            bool active,
            bool soldOut
        )
    {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        Card memory card = cards[cardId];
        uint256 stockVal = uint256(card.stock);
        uint256 initStock = uint256(card.initialStock > 0 ? card.initialStock : DEFAULT_STOCK_PER_CARD);
        return (
            uint256(card.price),
            stockVal,
            initStock >= stockVal ? initStock - stockVal : 0,
            card.active,
            stockVal == 0
        );
    }

    /**
     * @notice Concise summary of a card slot.
     */
    function getCardInfo(uint256 cardId)
        external
        view
        returns (
            uint256 price,
            uint256 stock,
            bool active
        )
    {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        Card memory card = cards[cardId];
        return (uint256(card.price), uint256(card.stock), card.active);
    }

    /**
     * @notice Returns complete state of all cards in a single RPC query.
     * @dev Loads packed struct in 1 SLOAD per slot and dynamically sizes to totalCardTypes.
     * @return prices Array of prices in Wei.
     * @return stocks Array of remaining stock counts.
     * @return activeStatuses Array of boolean availability statuses.
     */
    function getAllCardsInfo()
        external
        view
        returns (
            uint256[] memory prices,
            uint256[] memory stocks,
            bool[] memory activeStatuses
        )
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

    /**
     * @notice Returns total number of minted units for a given card.
     */
    function getMintedCount(uint256 cardId) external view returns (uint256) {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        Card memory card = cards[cardId];
        uint256 initStock = uint256(card.initialStock > 0 ? card.initialStock : DEFAULT_STOCK_PER_CARD);
        uint256 stockVal = uint256(card.stock);
        return initStock >= stockVal ? initStock - stockVal : 0;
    }

    /**
     * @notice Returns the contract-level metadata URI (OpenSea standard).
     */
    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    /**
     * @notice Returns the token metadata URI adhering to the ERC-1155 standard.
     */
    function uri(uint256 cardId) public view virtual override returns (string memory) {
        if (cardId < 1 || cardId > totalCardTypes) revert InvalidCardId(cardId);
        return super.uri(cardId);
    }

    // =========================================================================
    //                        OWNER ADMINISTRATION
    // =========================================================================

    /**
     * @notice Updates the default secondary market royalty (ERC-2981).
     * @param receiver Destination address for royalty payments.
     * @param feeNumerator Basis points numerator (capped at MAX_ROYALTY_BPS = 1000).
     */
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        if (receiver == address(0)) revert InvalidRoyaltyReceiver();
        if (feeNumerator > MAX_ROYALTY_BPS) {
            revert RoyaltyFeeTooHigh(feeNumerator, MAX_ROYALTY_BPS);
        }

        _setDefaultRoyalty(receiver, feeNumerator);
        emit RoyaltyUpdated(receiver, feeNumerator);
    }

    /**
     * @notice Sets an individual royalty fee for a specific card (ERC-2981).
     * @param tokenId Identifier of the card.
     * @param receiver Destination address for royalty payments.
     * @param feeNumerator Basis points numerator (capped at MAX_ROYALTY_BPS = 1000).
     */
    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 feeNumerator
    ) external onlyOwner {
        if (tokenId < 1 || tokenId > totalCardTypes) revert InvalidCardId(tokenId);
        if (receiver == address(0)) revert InvalidRoyaltyReceiver();
        if (feeNumerator > MAX_ROYALTY_BPS) {
            revert RoyaltyFeeTooHigh(feeNumerator, MAX_ROYALTY_BPS);
        }

        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    /**
     * @notice Pauses contract operations (halts purchases and token transfers).
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses contract operations.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Updates the base IPFS token metadata URI.
     */
    function setURI(string memory newURI) external onlyOwner {
        if (bytes(newURI).length == 0) revert EmptyMetadataURI();
        _setURI(newURI);
        emit BaseURIUpdated(newURI);
    }

    /**
     * @notice Updates the collection metadata URI.
     */
    function setContractURI(string memory newContractURI) external onlyOwner {
        if (bytes(newContractURI).length == 0) revert EmptyContractURI();
        _contractURI = newContractURI;
        emit ContractURIUpdated(newContractURI);
    }

    /**
     * @notice Safely withdraws all accumulated contract ETH to a designated recipient address.
     * @dev Follows Clean Code separation; protects against empty withdrawals and zero address.
     * @param recipient Target address to receive the funds.
     */
    function withdrawTo(address payable recipient) public onlyOwner nonReentrant {
        if (recipient == address(0)) revert InvalidRecipient();

        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFundsToWithdraw();

        (bool success, ) = recipient.call{value: balance}("");
        if (!success) revert ETHTransferFailed();

        emit FundsWithdrawn(recipient, balance);
    }

    /**
     * @notice Convenience withdrawal routing all accumulated ETH to the contract owner.
     */
    function withdraw() external onlyOwner {
        withdrawTo(payable(owner()));
    }

    // =========================================================================
    //                       INTERNAL HOOKS & OVERRIDES
    // =========================================================================

    /**
     * @dev OpenZeppelin v5 update hook. Controls token mints, burns, and transfers.
     * Enforces whenNotPaused so token transfers are paused alongside purchases during emergencies.
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override(ERC1155) whenNotPaused {
        super._update(from, to, ids, values);
    }

    /**
     * @dev ERC-165 interface declaration for ERC1155, ERC2981, and standard interfaces.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
