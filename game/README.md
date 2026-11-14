# DeFi Vending Machine 3D

Jogo 3D de navegador (Three.js, low-poly) para a coleção ERC-1155 **DeFi Vending Machine**: uma vending machine numa rua noturna com 30 cards (grade 5 linhas A–E × 6 colunas 1–6). Você anda até a máquina, escolhe um card e paga com a carteira do navegador ou por QR Code (EIP-681). Funciona 100% no navegador, sem servidor: lê o contrato por RPC e as imagens por gateways IPFS.

## Rodar
```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm test         # vitest
npm run build    # gera dist/
```
Qualidade gráfica: o jogo escolhe sozinho (baixa/média/alta) pelo aparelho e ajusta a resolução em tempo real. Para forçar: `?quality=low`, `?quality=medium` ou `?quality=high`.

## Configuração (variáveis `VITE_`, lidas no **build**)
`npm run dev` lê `.env.development` (local, não vai para o git; o deploy local em `..` já o preenche). `npm run build` lê `.env.production` (público, versionado). Variáveis do ambiente/GitHub Actions têm prioridade sobre os arquivos.

| Variável | Para quê |
| --- | --- |
| `VITE_CONTRACT_ADDRESS` | endereço do contrato. **Vazio = modo demo** (compra simulada, só para desenvolver) |
| `VITE_METADATA_CID` | CID da pasta de metadados (usado só no modo demo; com contrato, a URI vem do próprio contrato) |
| `VITE_CHAIN_ID` / `VITE_CHAIN_NAME` | rede do contrato (padrão: 11155111 / Sepolia; 31337 / Local no Hardhat) |
| `VITE_RPC_URL` | RPC usado para ler o contrato (padrão: RPC público da Sepolia) |
| `VITE_EXPLORER_URL` | explorer para links de transação/contrato/card (padrão Sepolia; vazio na rede local) |
| `VITE_PINATA_GATEWAY` | (opcional) domínio do gateway dedicado do Pinata, tentado antes dos públicos |
| `VITE_SITE_URL` | (opcional) URL pública do site, para a imagem de compartilhamento (`og:image`) |

Tudo que começa com `VITE_` vai para o JavaScript público: **nunca coloque chaves ou segredos aqui** (nem RPC com chave de API).

Sem `VITE_METADATA_CID`, o modo demo lê metadados e imagens de `public/dev-metadata` e `public/dev-images` (links simbólicos para `..`, só para desenvolvimento; ficam fora do build).

## Como usar
- **Andando:** mouse olha (o primeiro clique ou tecla captura o cursor), `WASD` move, mira no centro. Perto da máquina e olhando para ela aparece **[E] Usar a máquina**. O cartaz do faucet também usa **E** (no celular, o botão da direita).
- **Selecionando:** a câmera segue o card. Mouse, setas ou `WASD` escolhem; Enter ou clique confirma; `Esc` sai. No celular, toque escolhe e toque de novo confirma.
- **Pagando:** a câmera vai para a telinha LCD da máquina com o card, o preço e o botão **PAGAR COM CARTEIRA** (clique no 3D). Não há QR Code de pagamento. Sem extensão de carteira, no celular, aparece **ABRIR NA CARTEIRA**, que abre o link de pagamento direto no aplicativo da carteira.
- **Inventário (`I`):** saldos de todos os cards, card em 3D (arrastar gira, roda/pinça dá zoom, duplo clique restaura), estoque e emitidos, **enviar card** a outro endereço (irreversível, com aviso e confirmação), links do contrato e do card no explorer, conexão/desconexão da carteira.
- **Painel LED vermelho:** mostra só `DISPONIVEL` / `INDISPONIVEL` (contrato pausado) ou `SEM REDE`.

## O que vem do contrato
Preço, estoque, ativo e quantos cards existem (`getAllCardsInfo`), emitidos (`getMintedCount`), pausa (`paused`), saldos (`balanceOfBatch`), URI dos metadados (`uri`), compra (`buyCard(id)`, sempre 1 unidade) e envio (`safeTransferFrom`). Enquanto você está na máquina ou no inventário, o jogo observa os eventos (`CardPurchased`, `CardSoldOut`, `CardStatusUpdated`, `CardAdded`, `Paused`, `Unpaused`) e atualiza o estoque sozinho. Se faltar conexão com a rede, mostra um aviso e tenta de novo.

## Organização
| Pasta | Conteúdo |
| --- | --- |
| `src/scene` | cena 3D: máquina, cenário, cards, etiquetas de preço, seletor, visualizador de card |
| `src/player` | movimento, câmera suave, seleção |
| `src/payment` | carteira (EIP-1193), pagamento, envio, LCD da telinha |
| `src/data` | RPC enxuto (sem biblioteca), cache de inventário, IPFS, decodificação de imagens |
| `src/hud` | HUD e inventário (DOM) |
| `src/render` | renderizador, qualidade adaptativa |

Compatibilidade alvo: Chrome/Brave 89+, Firefox 89+, Safari/iOS 15+ (WebGL2). O jogo só desenha quando algo muda (economiza bateria) e se recupera se o sistema derrubar o contexto WebGL.

## Publicar (GitHub Pages)
1. Faça o deploy do contrato na Sepolia (`..`, veja `docs/DEPLOY.md`): ele grava o endereço em `.env.production` daqui.
2. Opcional: preencha `VITE_SITE_URL` (imagem de compartilhamento).
3. **Pelo GitHub Actions:** em *Settings > Pages* escolha "GitHub Actions"; faça push na `main`. O workflow `.github/workflows/pages.yml` roda os testes e publica. Para trocar valores sem commit, use *Settings > Secrets and variables > Actions > Variables* (`VITE_CONTRACT_ADDRESS`, `VITE_RPC_URL`...).
4. **Pelo seu computador:** `npm run build` e publique a pasta `dist/` (o build usa `base: './'`, funciona em `usuario.github.io/repo/`).

O build de produção **falha** se `VITE_CONTRACT_ADDRESS` estiver vazio ou se apontar para a rede local, para nunca publicar o modo demo por engano. Antes de publicar, confira também `external_url` e royalties dos metadados (`..`).

## Licença
Código sob licença MIT (veja `LICENSE`). **As imagens dos cards não são cobertas por esta licença**: pertencem aos respectivos autores/detentores.
