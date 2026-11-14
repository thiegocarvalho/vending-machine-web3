// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface IVM { function buyCard(uint256) external payable; function buyCardsBatch(uint256[] calldata, uint256[] calldata) external payable; }
/// Só para testes: tenta comprar de novo (reentrar) dentro do callback de recebimento do ERC-1155.
contract ReentrantBuyer {
    IVM public vm_; uint256 public price; bool public reenterTried; bool public reenterOk;
    constructor(address v, uint256 p) { vm_ = IVM(v); price = p; }
    function attack() external payable { vm_.buyCard{value: price}(1); }
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4) {
        reenterTried = true;
        try vm_.buyCard{value: price}(2) { reenterOk = true; } catch { reenterOk = false; }
        return this.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns (bytes4) { return this.onERC1155BatchReceived.selector; }
    receive() external payable {}
}
