# DeFi Vending Machine 3D

Jogo 3D de navegador (Three.js, estilo PS1): uma vending machine num estacionamento escuro com os 30 cards ERC-1155 (grade 5 linhas A–E × 6 colunas 1–6). Compra por QR Code (EIP-681) ou pela carteira do navegador, na Sepolia.

## Rodar
```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm test         # vitest
npm run build
```

## Configuração (`.env`, prefixo `VITE_`)
| Variável | Para quê |
| --- | --- |
| `VITE_CONTRACT_ADDRESS` | endereço do contrato na Sepolia. **Vazio = modo demo** (compra simulada) |
| `VITE_METADATA_CID` | CID da pasta de metadados no Pinata/IPFS |
| `VITE_PINATA_GATEWAY` | (opcional) domínio do gateway dedicado do Pinata |
| `VITE_SEPOLIA_RPC_URL` | (opcional) RPC da Sepolia |

Sem `VITE_METADATA_CID` o jogo lê metadados e imagens de `public/dev-metadata` e `public/dev-images` (links simbólicos para `../Contratos`, só para desenvolvimento).

Com o contrato configurado, tudo vem do contrato (`uri`, `getAllCardsInfo`) e dos gateways IPFS (Pinata → ipfs.io → dweb.link).

## Controles
Desktop: WASD andar · arrastar olhar · setas escolher card · Enter pagar · clique num card. Mobile: joystick, D-pad, toque no card, arrastar para olhar.
