# DeFi Vending Machine 3D

Jogo 3D de navegador (Three.js, low-poly): uma vending machine numa rua noturna com os 30 cards ERC-1155 (grade 5 linhas A–E × 6 colunas 1–6). Compra por QR Code (EIP-681) ou pela carteira do navegador, na Sepolia.

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

Com o contrato configurado, tudo vem do contrato (`uri`, `getAllCardsInfo`) e dos gateways IPFS (Pinata dedicado → gateway.pinata.cloud → ipfs.filebase.io; ipfs.io e dweb.link não servem mais por fetch).

## Controles e modos
- **Andar:** mouse olha sem precisar clicar (o primeiro clique ou tecla captura o cursor), WASD move, mira no centro. Perto da máquina e olhando para ela aparece o prompt **[E] Usar a máquina**.
- **Selecionar:** a câmera segue o card; setas/WASD ou o mouse escolhem, o painel LED vermelho mostra o slot (ex.: `B3 #09`), Enter/clique confirma, Esc sai.
- **Pagar:** a câmera vai para a telinha da máquina com o QR Code e o botão **PAGAR COM CARTEIRA** (clique no 3D). Esc volta.
- **Mobile:** joystick + botão USAR; na seleção, D-pad + CONFIRMAR + VOLTAR; toque num card seleciona e toca de novo confirma.
