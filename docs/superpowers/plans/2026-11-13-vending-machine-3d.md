# Vending Machine 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir os 30 cards ao IPFS (Pinata), publicar o contrato na Sepolia e construir o jogo 3D de navegador (estilo PS1) com a vending machine num estacionamento, HUD desktop/mobile e compra por QR ou carteira.

**Architecture:** Duas partes. (A) No projeto atual `Contratos/`: script de upload no Pinata, toolchain Hardhat para compilar/testar/publicar o contrato real. (B) Projeto novo `Contratos-3D/` (Vite + Three.js + viem): módulos puros e testáveis (grade, movimento, IPFS, EIP-681, seleção) separados dos módulos de cena/HUD; todos os dados dos cards vêm do contrato (`uri`, `getAllCardsInfo`) e dos gateways IPFS.

**Tech Stack:** Node 22, Vite, Three.js, viem, qrcode, Vitest (projeto 3D), Hardhat + OpenZeppelin (contrato), Pinata API v1.

**Spec:** `docs/superpowers/specs/2026-11-13-vending-machine-3d-design.md`

## Global Constraints

- Grade **5 linhas (A–E) × 6 colunas (1–6)**; card #1 = A1 … #30 = E6 (id = (linha·6)+coluna). 100 unidades por card, **sem raridade** em nenhum lugar.
- Cards 1200×1600 (3:4). Paleta ZERU: `#FF0033`, `#08080A`, `#FFFFFF`. Fontes: Bebas Neue, Space Grotesk, Fira Code.
- Rede: Sepolia, chainId `11155111`. Compra: `buyCard(uint256 cardId)` payable. Evento: `CardPurchased(address indexed buyer, uint256 indexed cardId, uint256 amount, uint256 totalCost, uint256 remainingStock)`. Dados: `getAllCardsInfo() → (uint256[] prices, uint256[] stocks, bool[] active)` (índice i = card i+1); `uri(cardId)`.
- QR EIP-681: `ethereum:<contrato>@11155111/buyCard?uint256=<id>&value=<wei>` (wei como inteiro decimal, via BigInt).
- Gateways: Pinata dedicado (se houver domínio) primeiro, depois `https://ipfs.io/ipfs/` e `https://dweb.link/ipfs/`; troca automática em falha/timeout.
- Movimento limitado por parede invisível circular (raio 7 m); iluminação baixa fora do foco da máquina.
- Credenciais só em `.env` (nunca em código, logs ou commits). Breakpoint HUD: 900 px; alvos de toque ≥ 44 px.
- **Commits sem `Co-Authored-By` nem qualquer trailer de coautoria/atribuição** (regra do usuário, vale também para PRs).
- Upload no Pinata e deploy na Sepolia **publicam** coisas: só executar com confirmação do usuário naquele momento.

## Review Focus

1. Carteira ausente (`window.ethereum` indefinido): botão de carteira some/desabilita e o QR continua funcionando.
2. Carteira na rede errada ou usuário rejeita a transação / sem saldo: mensagem clara, sem travar o fluxo.
3. Card esgotado ou inativo selecionado: SOLD OUT visível, pagamento bloqueado.
4. Todos os gateways falham ou um JSON vem incompleto: placeholder com número + botão de tentar de novo, jogo continua.
5. Rotação/redimensionamento do celular e viewport pequeno (320 px): HUD não cobre a máquina nem sai da tela; jogador nunca atravessa a parede invisível.

---

## Parte A — Projeto atual (`/home/zeru/Projects/Aulas/Contratos`)

### Task 1: Upload Pinata e metadados com CID real

**Files:**
- Create: `scripts/pinata_upload.js`, `test/pinata_upload.test.js`, `ipfs-cids.json` (gerado)
- Modify: `scripts/generate_metadata.js` (lê `imagesCid` de `ipfs-cids.json`), `package.json` (scripts `upload:pinata`, `test` roda os dois testes)

**Interfaces:**
- Produces: `ipfs-cids.json` = `{ "imagesCid": string, "metadataCid": string }`; `buildImageUri(imagesCid: string, fileName: string): string` → `ipfs://<cid>/<fileName>`; `selectMetadataFiles(dir: string): string[]` → os 30 arquivos de 64 hex + `contractURI.json` (ignora os `N.json` duplicados).
- Consumes: `.env` com `PINATA_JWT`.

- [ ] **Step 1: Write failing tests** em `test/pinata_upload.test.js` (estilo `assert` do projeto): `buildImageUri("bafyX","01_A1.png") === "ipfs://bafyX/01_A1.png"`; `selectMetadataFiles("metadata")` retorna 31 itens, todos `^[0-9a-f]{64}\.json$` ou `contractURI.json`; o JSON gerado para o card 1 com `imagesCid` "bafyX" tem `image === "ipfs://bafyX/01_A1.png"` e nenhum atributo `Rarity`.
- [ ] **Step 2: Run** `node test/pinata_upload.test.js` → FAIL (funções inexistentes).
- [ ] **Step 3: Implement** as duas funções e a leitura de `ipfs-cids.json` no gerador. Upload em `pinFileToIPFS` (multipart, `pinataOptions.wrapWithDirectory`, `filepath` por arquivo) usando `fetch`/`FormData` nativos; fluxo: sobe `generated_cards/` → grava `imagesCid` → regenera metadados → sobe metadados → grava `metadataCid`. Flag `--dry-run` lista o que enviaria sem chamar a API.
- [ ] **Step 4: Run** `npm test` → PASS; `node scripts/pinata_upload.js --dry-run` lista 30 imagens + 31 JSONs.
- [ ] **Step 5: Com confirmação do usuário**, rodar `npm run upload:pinata`. Verificar: `https://ipfs.io/ipfs/<metadataCid>/0000…01.json` retorna o JSON do card 1 com `image` apontando para `imagesCid`.
- [ ] **Step 6: Commit** (sem trailer de coautoria). O projeto atual não é repositório git: rodar `git init` antes, com `.gitignore` já contendo `.env`.

### Task 2: Hardhat, contrato compilado e testado de verdade

**Files:**
- Create: `hardhat.config.js`, `test/hardhat/VendingMachine1155.test.js`
- Modify: `package.json` (devDependencies `hardhat`, `@nomicfoundation/hardhat-toolbox`, `@openzeppelin/contracts`; script `test:contract`)

**Interfaces:**
- Produces: contrato compilável; fixture `deploy()` retornando `{ vm, owner, buyer }` com `baseURI = "ipfs://bafyTEST/{id}.json"`, `defaultPrice = 100000000000000n`.
- Nota: os testes atuais (`test/vending_machine.test.js`) validam um **simulador em JS**, não o Solidity; estes passam a validar o contrato real.

- [ ] **Step 1: Write failing tests** (mocha/chai do Hardhat): `buyCard(1)` com valor exato emite `CardPurchased(buyer, 1, 1, price, 99)` e `balanceOf(buyer,1) == 1`; `getAllCardsInfo()` retorna 30 posições, estoque 100, todos ativos; `uri(1)` começa com `ipfs://bafyTEST/`; `buyCard(31)` reverte `InvalidCardId`; 101ª compra de um card reverte por estoque.
- [ ] **Step 2: Run** `npx hardhat test` → FAIL/erro de compilação até configurar solc ^0.8.20.
- [ ] **Step 3: Implement** configuração (solc 0.8.24, otimizador 200 runs, redes `hardhat` e `sepolia` lendo `SEPOLIA_RPC_URL` e `DEPLOYER_PRIVATE_KEY` do `.env`).
- [ ] **Step 4: Run** `npx hardhat test` → PASS.
- [ ] **Step 5: Commit.**

---

## Parte B — Projeto novo (`/home/zeru/Projects/Aulas/Contratos-3D`)

### Task 3: Scaffold Vite + renderer PS1

**Files:**
- Create: `package.json`, `index.html`, `src/main.js`, `src/render/ps1Renderer.js`, `src/config.js`, `.gitignore`, `vitest.config.js`
- Test: `src/config.test.js`

**Interfaces:**
- Produces: `config` = `{ chainId: 11155111, contractAddress: string, metadataCid: string, gateways: string[], demoMode: boolean, wallRadius: 7 }`; `createPs1Renderer(canvas: HTMLCanvasElement): { renderer, resize(w:number,h:number):void, render(scene,camera):void }` (render em 1/3 da resolução, `NearestFilter`, upscale com `image-rendering: pixelated`).

- [ ] **Step 1:** `git init`; `npm create vite` (vanilla), instalar `three`, `viem`, `qrcode`, `vitest`.
- [ ] **Step 2: Write failing test:** `config.gateways[0]` é Pinata ou `https://ipfs.io/ipfs/`, todos terminam com `/`; `config.wallRadius === 7`; `config.chainId === 11155111`.
- [ ] **Step 3: Implement** `config.js` (valores via `import.meta.env`, `demoMode` verdadeiro enquanto `VITE_CONTRACT_ADDRESS` estiver vazio) e `ps1Renderer.js`.
- [ ] **Step 4:** `npx vitest run` → PASS; `npm run dev` abre cena preta com pixelização visível (verificar no navegador).
- [ ] **Step 5: Commit.**

### Task 4: Grade e slots

**Files:** Create `src/grid.js`; Test `src/grid.test.js`

**Interfaces:**
- Produces: `cardIdToSlot(id: number): { id, row: number, col: number, label: string }` (`1 → A1`, `30 → E6`, `row` 0–4, `col` 0–5, lança `RangeError` fora de 1–30); `slotToCardId(row,col): number`; `moveSelection(id: number, dir: "up"|"down"|"left"|"right"): number` (clampa nas bordas).

- [ ] **Step 1: Write failing tests:** `cardIdToSlot(1).label === "A1"`; `cardIdToSlot(6).label === "A6"`; `cardIdToSlot(7).label === "B1"`; `cardIdToSlot(30).label === "E6"`; `cardIdToSlot(0)` e `(31)` lançam; `moveSelection(1,"left") === 1`; `moveSelection(6,"right") === 6`; `moveSelection(1,"down") === 7`; `moveSelection(30,"down") === 30`; `slotToCardId(4,5) === 30`.
- [ ] **Step 2–4:** rodar (FAIL) → implementar → rodar (PASS).
- [ ] **Step 5: Commit.**

### Task 5: Modelo da vending machine por código

**Files:** Create `src/scene/machine.js`, `src/scene/palette.js`

**Interfaces:**
- Consumes: `cardIdToSlot`.
- Produces: `buildMachine(): { group: THREE.Group, slotAnchors: THREE.Object3D[] /* índice id-1 */, screenMesh: THREE.Mesh /* tela da coluna de controle */, trayAnchor: THREE.Object3D }`.
- Layout (da referência do usuário): corpo preto com bordas carmesim; janela de vidro semitransparente ocupando ~70% da frente à esquerda com 5 prateleiras × 6 slots (cards 3:4 em pé, levemente inclinados); coluna à direita com tela, leitor de cartão, teclado 3×4, slot de moedas; bandeja de retirada embaixo; grade de ventilação na base.

- [ ] **Step 1: Write failing test** (vitest, sem WebGL): `buildMachine().slotAnchors.length === 30` e a âncora do card 1 tem y maior que a do card 30 e x menor que a do card 6.
- [ ] **Step 2–4:** rodar (FAIL) → implementar geometrias simples (BoxGeometry/PlaneGeometry, materiais `MeshLambertMaterial` com `flatShading`) → rodar (PASS) → conferir visualmente no navegador (screenshot) que se parece com a referência.
- [ ] **Step 5: Commit.**

### Task 6: Estacionamento, iluminação e movimento com parede invisível

**Files:** Create `src/scene/parkingLot.js`, `src/player/movement.js`, `src/player/controls.js`; Test `src/player/movement.test.js`

**Interfaces:**
- Produces: `buildParkingLot(): THREE.Group` (asfalto, faixas de vaga, poste fraco, cone/bloco; `scene.fog` escuro); `clampToWall(x:number, z:number, radius:number, center?:{x,z}): {x,z}` (reposiciona no círculo mantendo a direção); `createControls(camera, domElement, opts): { update(dt:number):void, enableTouch():void }` (WASD + mouse; joystick virtual + arrastar no mobile; altura do olho 1.6 m; sempre aplica `clampToWall`).

- [ ] **Step 1: Write failing tests:** `clampToWall(3,4,7)` → `{3,4}` (dentro); `clampToWall(14,0,7)` → `{7,0}`; `clampToWall(0,-10,7)` → `{0,-7}`; ponto na origem → inalterado.
- [ ] **Step 2–4:** FAIL → implementar → PASS; verificar no navegador que é impossível sair do raio andando contra a escuridão.
- [ ] **Step 5: Commit.**

### Task 7: Camada de dados (contrato + IPFS)

**Files:** Create `src/data/ipfs.js`, `src/data/chain.js`, `src/data/demo.js`; Test `src/data/ipfs.test.js`

**Interfaces:**
- Produces: `ipfsToHttp(uri: string, gateway: string): string` (`ipfs://CID/path` → `gateway+CID/path`; `https://` passa direto); `fetchIpfs(uri: string, gateways: string[], opts?: { timeoutMs?: number, as?: "json"|"blob" }): Promise<any>` (tenta cada gateway em ordem; erro agregado se todos falharem); `loadCardsInfo(): Promise<{ price: bigint, stock: number, active: boolean }[]>` (30 posições; no `demoMode` vem de `demo.js` com preço `100000000000000n` e estoque 100); `tokenMetadataUri(id: number): Promise<string>` (chama `uri(id)` no contrato, ou usa `config.metadataCid` no demo mode, e substitui `{id}` pelo hex minúsculo de 64 dígitos do id); `loadMetadata(id: number): Promise<{ name: string, description: string, image: string, attributes: any[] }>`.

- [ ] **Step 1: Write failing tests** (com `fetch` mockado): `ipfsToHttp("ipfs://abc/1.json","https://ipfs.io/ipfs/") === "https://ipfs.io/ipfs/abc/1.json"`; `fetchIpfs` com o primeiro gateway retornando 500 e o segundo 200 devolve o corpo do segundo; com todos falhando rejeita; timeout de gateway lento passa para o seguinte; hex do id 30 é `…001e` com 64 dígitos.
- [ ] **Step 2–4:** FAIL → implementar (viem `createPublicClient` + `http()` em Sepolia; ABI mínima `uri`, `getAllCardsInfo`, `buyCard`, evento `CardPurchased`) → PASS.
- [ ] **Step 5: Commit.**

### Task 8: Cards nas prateleiras

**Files:** Create `src/scene/cards.js`

**Interfaces:**
- Consumes: `buildMachine().slotAnchors`, `loadMetadata`, `fetchIpfs(..., {as:"blob"})`, `loadCardsInfo`.
- Produces: `populateCards(anchors: THREE.Object3D[], infos): { setSoldOut(id:number,v:boolean):void, retry(id:number):Promise<void>, onLoaded(cb:(id:number, meta)=>void):void }`; cada card é um plano 3:4 com placeholder escuro e número até a textura chegar; imagem redimensionada (600×800) via canvas antes de virar `CanvasTexture` com `NearestFilter`; carregamento paralelo com limite de 6.

- [ ] **Step 1:** Implementar; falha de um card não impede os demais (placeholder com marca "!" + `retry`).
- [ ] **Step 2:** Verificar no navegador (demo mode apontando para o CID real do Task 1): 30 cards aparecem nos slots A1–E6 na ordem certa; simular falha derrubando o gateway primário.
- [ ] **Step 3: Commit.**

### Task 9: Seleção e foco de câmera

**Files:** Create `src/player/selection.js`; Test `src/player/selection.test.js`

**Interfaces:**
- Consumes: `moveSelection`, `cardIdToSlot`.
- Produces: `createSelection(initial?: number): { id: number, move(dir):number, set(id:number):void, onChange(cb:(id:number)=>void):void }`; `pickCard(raycaster, anchors): number | null`; `focusOn(camera, anchor): Promise<void>` (animação suave, respeita a parede invisível).

- [ ] **Step 1: Write failing tests:** estado inicial 1; `move("right")` → 2 e dispara `onChange(2)`; `move("up")` no card 1 não dispara; `set(31)` lança.
- [ ] **Step 2–4:** FAIL → implementar → PASS; teclas ↑↓←→ e Enter; clique/toque usa `pickCard`.
- [ ] **Step 5: Commit.**

### Task 10: HUD desktop e mobile

**Files:** Create `src/hud/hud.js`, `src/hud/hud.css`, `src/hud/minimap.js`; Test `src/hud/minimap.test.js`

**Interfaces:**
- Consumes: `createSelection`, `loadMetadata`, `loadCardsInfo`.
- Produces: `createHud(root: HTMLElement, deps): { showCard(id:number, meta, info):void, setWallet(state:"none"|"disconnected"|"connected"|"wrongNetwork", address?:string):void, setPayment(state:PaymentState):void, onPay(cb:()=>void):void, onShowQr(cb:()=>void):void, onDpad(cb:(dir)=>void):void }`; `renderMinimap(selectedId:number): string[][]` (5×6, marca o selecionado).
- Desktop (≥ 900 px): painel de detalhe à direita (nome, edição, estoque, preço em ETH, botões **QR** e **Pagar com carteira**), mini-mapa 5×6, dica de controles embaixo. Mobile (< 900 px): bottom sheet que abre ao tocar num card, D-pad no canto, mini-mapa compacto no topo, joystick, `env(safe-area-inset-*)`.
- Sem raridade em nenhum campo.

- [ ] **Step 1: Write failing test:** `renderMinimap(1)` → matriz 5×6 com só `[0][0]` marcada; `renderMinimap(30)` → só `[4][5]`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Verificar no navegador em 1280×800, 768×1024 e 375×812 (e 320×568): nada cobre a máquina no estado padrão, nada sai da tela, botões ≥ 44 px, rotação funciona.
- [ ] **Step 6: Commit.**

### Task 11: Pagamento (QR + carteira)

**Files:** Create `src/payment/eip681.js`, `src/payment/wallet.js`, `src/payment/watcher.js`, `src/payment/machineScreen.js`; Test `src/payment/eip681.test.js`, `src/payment/wallet.test.js`

**Interfaces:**
- Produces: `buildEip681(contract: string, chainId: number, cardId: number, priceWei: bigint): string` → `ethereum:<contract>@11155111/buyCard?uint256=<id>&value=<wei>`; `type PaymentState = "idle" | "awaiting" | "sent" | "confirmed" | "error"`; `hasWallet(win): boolean`; `payWithWallet(win, cfg, cardId, priceWei): Promise<{ hash: string }>` (EIP-1193: `eth_requestAccounts`, `wallet_switchEthereumChain` com fallback `wallet_addEthereumChain` para Sepolia, `eth_sendTransaction` com `data` de `buyCard`); `watchPurchase(cardId, buyer?): { on(cb:(e)=>void):void, stop():void }` (polling de logs `CardPurchased`); `drawQrOnScreen(screenMesh, text: string, state: PaymentState): void`.
- Estados na tela 3D e no HUD: aguardando → enviada → confirmada (card cai na bandeja, link Etherscan `https://sepolia.etherscan.io/tx/<hash>`) / erro com mensagem (rede errada, saldo, esgotado, rejeitado).

- [ ] **Step 1: Write failing tests:** `buildEip681("0xAbC…",11155111,5,100000000000000n)` contém `@11155111/buyCard?uint256=5&value=100000000000000` (sem notação científica); `hasWallet({})` é falso; `payWithWallet` com `ethereum` falso: se `eth_chainId` ≠ `0xaa36a7` chama `wallet_switchEthereumChain` antes de enviar; erro `4001` (rejeitado) vira erro tratado `"user_rejected"`; card esgotado (stock 0) não envia transação.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Em demo mode, simular `awaiting → sent → confirmed` e conferir tela 3D + HUD + animação do card na bandeja.
- [ ] **Step 6: Commit.**

### Task 12: Deploy na Sepolia e integração real

**Files:** Create `scripts/deploy.js` (em `Contratos/`); Modify `.env` (`SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `ETHERSCAN_API_KEY`) e `Contratos-3D/.env` (`VITE_CONTRACT_ADDRESS`, `VITE_METADATA_CID`)

- [ ] **Step 1: Pré-requisitos do usuário:** chave de uma carteira **de teste** da Sepolia com saldo de faucet, RPC da Sepolia e chave do Etherscan, colocadas no `.env` (nunca no chat).
- [ ] **Step 2:** `scripts/deploy.js` implanta com `baseMetadataURI = "ipfs://<metadataCid>/{id}.json"`, `initialContractURI = "ipfs://<metadataCid>/contractURI.json"`, `defaultPrice = 100000000000000n`, royalty receiver = deployer, 500 bps; imprime endereço.
- [ ] **Step 3: Com confirmação do usuário**, executar na Sepolia e verificar no Etherscan (`hardhat verify`).
- [ ] **Step 4:** Apontar o jogo para o endereço (`demoMode` falso). Verificar: 30 cards com preço/estoque reais; comprar um card por carteira e outro por QR (celular); estoque cai para 99; evento aparece no jogo.
- [ ] **Step 5: Commit.**

### Task 13: Passe final de plataforma e desempenho

- [ ] **Step 1:** Medir FPS (alvo 60 em celular médio emulado com throttling CPU 4×) e memória de texturas com os 30 cards.
- [ ] **Step 2:** Percorrer os casos do Review Focus em desktop e mobile; corrigir o que falhar.
- [ ] **Step 3:** README do projeto 3D (como rodar, `.env`, deploy) e atualização do `docs/07` do projeto atual (grade, fluxo, CIDs).
- [ ] **Step 4: Commit.**
