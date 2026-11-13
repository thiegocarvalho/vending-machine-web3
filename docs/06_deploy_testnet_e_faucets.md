# Módulo 06: Guia de Deploy na Testnet (Sepolia EVM) e Faucets

> *"Ver o contrato rodando em um explorador de blocos público é o momento em que a teoria vira realidade on-chain."*

---

## 1. Por que a Sepolia Testnet?

A Sepolia é a rede de testes oficial e recomendada pela Ethereum Foundation para desenvolvimento de contratos inteligentes e aplicações DeFi.
- **Ambiente 100% idêntico à Mainnet:** Mesmos opcodes da EVM, mesmo comportamento de gas e mesmos formatos de bloco.
- **Tokens não têm valor real:** ETH de teste serve exclusivamente para pagar gas de deploy e testar interações.
- **Explorador completo:** Totalmente suportada pelo [Etherscan Sepolia](https://sepolia.etherscan.io).

---

## 2. Como Conseguir ETH na Sepolia Sem Dor de Cabeça (Faucets)

Muitos faucets públicos hoje colocam barreiras como exigir saldo prévio na rede principal (mainnet) para evitar robôs. Aqui estão os métodos mais fáceis e garantidos:

### 1. Google Cloud Web3 Faucet (O Mais Rápido e Limpo)
- **Link:** [cloud.google.com/application/web3/faucet/ethereum/sepolia](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
- **Como funciona:** Faça login com qualquer conta Google, cole o endereço da sua carteira e receba 0.05 Sepolia ETH instantaneamente por dia, sem precisar de saldo prévio na mainnet.

### 2. Sepolia PoW Faucet (Sem Conta, à Prova de Bloqueios)
- **Link:** [sepolia-faucet.pk910.de](https://sepolia-faucet.pk910.de)
- **Como funciona:** Deixe uma aba aberta no navegador minerando por 1 a 2 minutos com a sua CPU. Quando acumular a quantidade desejada (ex: 0.1 a 0.5 ETH), clique em "Claim". Funciona em qualquer rede e sem cadastros.

### 3. Alternativa para Alunos com Restrições: Arbitrum Sepolia ou Base Sepolia
- Se algum aluno tiver dificuldade de conexão, as Layer 2 de teste (Base Sepolia ou Arbitrum Sepolia) usam o mesmo bytecode EVM e possuem faucets imediatos:
  - Base Sepolia: [faucets.chain.link](https://faucets.chain.link) ou Coinbase Faucet.

---

## 3. Passo a Passo do Deploy Via Remix IDE (Ideal para Aula Ao Vivo)

O Remix IDE é a ferramenta mais didática para demonstrar o deploy em sala de aula, pois não exige instalação de dependências locais pelos alunos.

1. Acesse [remix.ethereum.org](https://remix.ethereum.org).
2. Crie um novo arquivo: `VendingMachine1155.sol` e cole o código do contrato.
3. No painel de compilação (**Solidity Compiler**):
   - Escolha a versão `0.8.20` ou superior.
   - Clique em **Compile VendingMachine1155.sol**.
4. No painel de deploy (**Deploy & Run Transactions**):
   - Em **Environment**, selecione **Injected Provider - MetaMask** (certifique-se de que sua carteira está conectada na rede **Sepolia**).
   - Nos parâmetros do construtor:
     - `baseURI`: `"ipfs://bafybeicardplaceholder/{id}.json"`
     - `defaultPrice`: `100000000000000` (0.0001 ETH em Wei)
     - `defaultStock`: `100` (100 cópias de cada card)
   - Clique em **transact** e confirme a transação na carteira.
5. Copie o endereço gerado do contrato e abra no [Sepolia Etherscan](https://sepolia.etherscan.io) para conferir o contrato ativo no estado global!
