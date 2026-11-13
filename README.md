# Aula: DeFi & Smart Contracts — Do Chão à Máquina (Bottom to Top)

> **Engenharia de Contratos Inteligentes e Arquitetura EVM**  
> **Tema:** Arquitetura de Redes, Infraestrutura Multi-Chain e Contratos Inteligentes na Prática  
> **Projeto Prático Final:** Vending Machine ERC-1155 (Loja Retro 30 Cards)

---

## 🎯 Tese Pedagógica

A maioria das aulas de contratos e DeFi começa direto no Solidity ou na interface de uma DEX. Isso gera desenvolvedores e usuários que não entendem o que acontece quando uma transação falha, por que pontes são drenadas ou o que realmente significa "execução descentralizada".

Nesta aula adotamos a abordagem **Bottom-to-Top**:
1. **O Chão (Rede e Nós):** O que é a descentralização real — softwares compatíveis, estado compartilhado e transparência radical.
2. **A Validação (Blocos e Verificação Independente):** Como uma transação é empacotada e por que qualquer nó no mundo chega exatamente ao mesmo resultado sem precisar confiar em ninguém.
3. **A Selva de Infraestrutura (L0, L1, L2, Sidechains e Pontes):** Como as redes se organizam, a complexidade técnica de mover liquidez entre mundos isolados e a anatomia dos maiores desastres da história (hacks em pontes).
4. **A Anatomia de um Smart Contract:** O que é um contrato na EVM (código + storage + regras determinísticas).
5. **A Máquina na Prática (ERC-1155 Vending Machine):** Construção, teste e deploy de um contrato de máquina de venda de 30 cards colecionáveis na testnet, preparando o terreno para a experiência interativa 3D (estilo PS1) e metadados no IPFS.

> 💡 **Nota de Escopo:** Carteiras/chaves, detalhes profundos de Proof of Work vs Proof of Stake, e mecânicas de slashing possuem módulos específicos e não serão revisitados a fundo aqui, focando o tempo na arquitetura de execução e infraestrutura.

---

## 🗺️ Mapa da Aula

| Módulo | Nome | Foco Principal | Saída / Entregável |
| :---: | :--- | :--- | :--- |
| **01** | **A Base da Descentralização** | Nós compatíveis, replicação de estado e transparência como mecanismo de defesa | Roteiro conceitual & diagramas de nós |
| **02** | **Blocos e Execução Determinística** | Ciclo de vida da tx, state transitions e verificação local sem confiança | Passo a passo de validação por nó |
| **03** | **Infraestrutura: Camadas e Pontes** | L0, L1, L2 (Rollups), Sidechains; o problema do cross-chain e hacks em bridges | Matriz de camadas & autópsia de hacks |
| **04** | **O que é um Smart Contract** | Estado na EVM, imutabilidade, opcode dispatch e limites de execução | Anatomia do contrato |
| **05** | **Contrato Vending Machine (ERC-1155)** | Gestão de estoque para 30 cards (5x6), precificação, saque e eventos | Código Solidity testado e documentado |
| **06** | **Deploy em Testnet (Sepolia/EVM)** | Configuração de RPC, Faucet, deploy, verificação no Etherscan e leitura de dados | Contrato live na testnet com estoque ativo |
| **07** | **Preparação para a Experiência 3D & IPFS** | Estrutura de metadados ERC-1155 (`{id}.json`), URI template e conexão com o frontend 3D (repo separado) | Schema de metadados e guia de integração |

---

## 📁 Estrutura deste Repositório

```text
Contratos/
├── README.md                      # Este roteiro geral e visão do curso
├── package.json                   # Scripts auxiliares e metadados do projeto
├── index.html -> apresentacao/    # Link direto para a apresentação
├── apresentacao/
│   └── index.html                 # Deck de slides interativo (Vermelho, Preto e Branco // ZERU ぜる)
├── docs/                          # Conteúdo detalhado de cada módulo para slides e apostila
│   ├── 01_descentralizacao_e_nos.md
│   ├── 02_blocos_e_verificacao.md
│   ├── 03_infra_layers_e_pontes.md
│   ├── 04_anatomia_smart_contracts.md
│   ├── 05_vending_machine_erc1155.md
│   ├── 06_deploy_testnet_e_faucets.md
│   └── 07_especificacao_cards_ipfs_e_game3d.md
├── contracts/                     # Contratos Solidity (Vending Machine ERC-1155)
│   └── VendingMachine1155.sol
├── test/                          # Suíte de testes unitários de regras de negócio
│   └── vending_machine.test.js
├── metadata/                      # 30 JSONs de metadados prontos para IPFS ({id}.json)
└── scripts/                       # Scripts auxiliares (geração de metadados)
    └── generate_metadata.js
```

---

## 🎨 Identidade Visual da Apresentação: ZERU [ぜる] (Vermelho, Preto e Branco)

A apresentação web (`apresentacao/index.html`) adota uma estética cyberpunk retrô industrial de alto impacto:
- **Paleta de Cores Estrita:** Vermelho Carmesim (`#FF0033`), Preto profundo (`#08080A`) e Branco puro (`#FFFFFF`).
- **Tipografia:** `Bebas Neue` (display pesado industrial), `Space Grotesk` (leitura), `Fira Code` (dados/código) e `DotGothic16` (Katakana/Kanji/Hiragana decorativo).
- **Elementos Visuais:** Faixas diagonais de perigo (hazard stripes), advertências militares ("警告"), bordas de alto contraste, scanlines suaves de tubo CRT com curvatura nos cantos e visual da Vending Machine retro dos anos 80/90.
- **Simuladores On-Chain:**
  1. Resiliência Web2 vs Web3 (Derrubar servidores/nós).
  2. Auditoria local determinística de blocos (Detecção instantânea de fraude).
  3. Mecânica de pontes (Lock & Mint vs Dreno de cofre estilo Ronin).
  4. Vending Machine interativa dos 30 cards com geração de QR Code EIP-681 em tempo real!

