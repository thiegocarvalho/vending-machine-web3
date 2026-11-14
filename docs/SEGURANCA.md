# Revisão de segurança (contrato `DefiVendingMachine1155`)

- **Slither** (102 detectores, solc 0.8.24, cancun, otimizador 200): 0 achados altos/médios, 3 informativos, todos intencionais:
  - `balance == 0` em `withdrawTo`: só evita saque vazio.
  - `emptyStocks` não inicializado em `addCardsBatch(uint128[])`: o array vazio é proposital (significa "estoque padrão").
  - chamada de baixo nível `recipient.call{value}` no saque: protegida por `nonReentrant`, `onlyOwner` e verificação do retorno.
- **Testes** (`npx hardhat test`): reentrada no callback ERC-1155, compra sempre de 1 em 1, pausa, posse em duas etapas, `renounceOwnership` bloqueado, royalties, estoque.
- **Aderyn** não rodou: a release v0.6.8 não publica binário Linux (e o pacote npm depende dele).
- Reexecutar o Slither (fora do projeto): crie um venv, `pip install slither-analyzer solc-select`, `solc-select install 0.8.24 && solc-select use 0.8.24`, e
  `slither contracts/VendingMachine1155.sol --solc-remaps "@openzeppelin/=node_modules/@openzeppelin/" --solc-args "--evm-version cancun --optimize --optimize-runs 200" --filter-paths "node_modules|mocks"`.
- Fora do escopo: auditoria humana independente (recomendada só antes de mainnet).
- **Contrato publicado e verificado:** `0x80F3Ace1F4e3eA3Ae4E42F893c885CD927c0634d` (Sepolia). O código na rede é idêntico ao compilado e analisado aqui.
