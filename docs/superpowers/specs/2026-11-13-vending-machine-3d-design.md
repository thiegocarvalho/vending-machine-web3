# Vending Machine 3D (navegador) — Design

> **Atualização (2026-11-13):** o visual PS1 foi trocado por **low-poly moderno** (render suave, sem pixelização nem vertex snapping), a cena virou uma rua noturna, e a performance usa luz assada, geometria estática fundida, resolução dinâmica e render sob demanda. Sem modo 2D e sem atlas de texturas: as imagens vêm do contrato/IPFS como NFTs separados (o campo padrão `image` segue apontando para a arte completa; `image_thumbnail` é um campo extra leve). Cache de navegador e otimização das imagens ficam para depois.

Data: 2026-11-13 · Status: aguardando aprovação (rev. 2 — cenário, pagamento e referência visual)

## Intenção
Parte 2 do projeto (a parte 1 é a apresentação): um jogo/cena 3D de navegador, estilo PS1, com uma vending machine vertical cheia dos 30 cards colecionáveis da coleção ERC-1155 "DeFi Vending Machine". O jogador vê a máquina, explora os cards e, numa etapa futura, compra pelo contrato na Sepolia. Serve também como demo ao vivo da aula (módulo 07).

## Metas
- Máquina modelada **por código** (sem GLTF/Blender), grade **5 linhas (A–E) × 6 colunas (1–6)**, igual ao contrato, aos metadados e ao `docs/07`. Card #1 = A1 … card #30 = E6.
- 30 cards como planos 3:4 com a textura de `generated_cards/` (1200×1600).
- Visual PS1: render em baixa resolução com upscale sem filtro, texturas `NearestFilter`, vertex wobble/snapping, sombras duras, névoa. Paleta ZERU: carmesim `#FF0033`, preto `#08080A`, branco.
- HUD que funciona em **desktop e mobile** (ver abaixo).
- Imagens e metadados no IPFS via Pinata; o jogo lê os dados reais dos metadados.

## Não-metas (nesta entrega)
- Animação de queda com física realista (a queda do card é uma animação simples, sem física).
- Cenário além do estacionamento; áudio; mainnet.
- Editor ou modelo feito à mão.

## Anti-metas
- Ficar pesado: o jogo deve rodar em celular médio a 60 fps com 30 texturas.
- Dependência de ferramentas externas para o modelo.
- Metadados do jogo divergindo do contrato (IDs, slots, estoque).

## Abordagens consideradas
1. **Three.js puro + Vite, máquina por código — escolhida** (decisão do usuário). Leve, ajustável por código, encaixa no estilo PS1.
2. Blender → GLTF: acabamento melhor, mas exige modelagem manual; fica como troca futura do corpo da máquina.
3. React Three Fiber: útil só se o jogo crescer em telas/menus; peso sem ganho agora.

## Cenário e movimentação (pedido do usuário)
- A máquina fica num **estacionamento** à noite. Iluminação baixa: um foco sobre a máquina e poucas luzes fracas; longe dela tudo mergulha em escuridão e névoa.
- A escuridão funciona como limite: o jogador anda em primeira pessoa numa área ao redor da máquina, e há uma **parede invisível** (colisão circular, raio ~6–8 m) onde a luz acaba, para limitar o movimento sem mostrar um muro.
- Mobile: joystick virtual para andar + arrastar para olhar. Desktop: WASD + mouse (pointer lock opcional).
- Cena mínima: chão de asfalto com faixas de vaga, poste/luz fraca, 2–3 props baixos (cone, bloco de concreto) para dar escala.

## Referência visual da máquina (imagem do usuário)
Máquina de snacks clássica: corpo alto; **janela de vidro à esquerda** (~70% da frente) com prateleiras; **coluna de controle à direita** com tela, leitor de cartão, teclado numérico e slot de moedas; **bandeja de retirada** embaixo; grade de ventilação na base. Minha adaptação: mesma silhueta e layout, trocando o laranja pela paleta ZERU (preto com bordas carmesim e branco), 5 prateleiras × 6 slots dentro da janela, cards em pé com leve inclinação; a tela da coluna de controle faz o papel da "máquina de cartão".

## Fluxo de compra (pedido do usuário)
1. Jogador seleciona um card (clique/toque ou setas/D-pad).
2. A tela da coluna de controle mostra o card, o preço e as opções de pagamento:
   - **QR Code** (EIP-681, `ethereum:<contrato>@11155111/buyCard?uint256=<id>&value=<wei>`), desenhado na tela da máquina em 3D e também ampliado no HUD para leitura no mobile;
   - **Botão "PAGAR COM CARTEIRA"**, usando a extensão do navegador (`window.ethereum`, EIP-1193) para chamar `buyCard(cardId)` na Sepolia, pedindo troca de rede se necessário.
3. Estados na tela da máquina: aguardando pagamento → transação enviada → confirmada → o card cai na bandeja (animação simples) e o HUD mostra "ADQUIRIDO" com link do Etherscan. Erros (rede errada, sem saldo, esgotado, usuário rejeitou) aparecem em texto claro.
4. A confirmação vem do evento `CardPurchased` / do recibo. No QR, o jogo observa o evento por polling do RPC para detectar o pagamento feito por carteira externa (celular).
- Preço, estoque e ativo vêm de `getAllCardsInfo()` do contrato; cards esgotados ficam com marca "SOLD OUT".
- **Contrato na Sepolia ao final:** deploy, verificação no Etherscan e preenchimento do endereço em `config`. Até lá, o jogo roda com endereço placeholder e um modo demo (compra simulada) para desenvolver e testar a interface.
- Biblioteca para a parte de carteira/RPC: `viem` (leve, só ABI e chamadas), escolha minha; QR com `qrcode`.

## Raridade (decisão do usuário)
Não existe raridade neste projeto: todos os 30 cards têm 100 unidades (já é o padrão do contrato: `MAX_SUPPLY_PER_CARD = 100`). O atributo "Rarity" foi removido dos metadados, do gerador e dos docs. Raridade será calculada em outro lugar, fora do contrato e do jogo; o HUD não a exibe.

## Decisões
- **Local:** projeto novo `/home/zeru/Projects/Aulas/Contratos-3D` (repo separado, como o `docs/07` previa). Stack: Vite + Three.js, JavaScript (sem framework de UI).
- **Pinata (feito antes do 3D):** script em `scripts/pinata_upload.js` no projeto atual: (1) sobe `generated_cards/` como pasta, (2) reescreve o campo `image` dos 30 JSONs para `ipfs://<CID>/<arquivo>.png`, (3) sobe `metadata/`. Credenciais lidas de `.env` (já salvo, no `.gitignore`). O CID da pasta de metadados é a URI base do contrato (`{id}.json`). Os CIDs ficam registrados em `ipfs-cids.json`.
- **Dados no jogo (decisão do usuário):** tudo vem do contrato. O jogo chama `uri(cardId)` e `getAllCardsInfo()` na Sepolia, resolve o `ipfs://<CID>/...` e baixa JSONs e imagens por **gateways IPFS** (gateway dedicado do Pinata primeiro, gateways públicos como `ipfs.io` e `dweb.link` como reserva, tentando o próximo se um falhar ou demorar). Sem cópias locais empacotadas.
- **Carregamento:** tela de loading PS1 enquanto baixa os 30 cards; texturas redimensionadas ao carregar (ex.: 600×800) e com cache do navegador; os cards aparecem na máquina conforme chegam (placeholder escuro com o número até lá).
- **Contrato:** `setURI("ipfs://<CID>/{id}.json")` com o CID da pasta de metadados no Pinata. CIDs registrados em `ipfs-cids.json`.
- **Desenvolvimento antes do deploy:** como o contrato só vai à Sepolia no final, o modo demo lê o mesmo CID direto (config), e usa um mock de estoque/preço.
- **Câmera:** órbita limitada em volta da máquina (OrbitControls com limites de ângulo e zoom), com foco suave num slot ao selecioná-lo.
- **Seleção:** clique/toque num card seleciona o slot; setas/WASD no desktop e botões na tela no mobile movem a seleção pela grade 5×6.
- **Modelo:** corpo escuro com bordas carmesim, vidro semitransparente, 5 prateleiras, 30 espirais, painel lateral com teclado numérico, display e bandeja inferior, no tom da arte do verso (`var1_thick_top.png`).

## HUD (proposta minha — corrigir se quiser outra coisa)
Elementos comuns: título "DEFI VENDING MACHINE", rede (Sepolia), indicador do slot selecionado (ex.: `A1`), cartão de detalhe do card (nome, edição, estoque e preço vindos do contrato) e botões de pagamento (QR / carteira) com estado da carteira.
- **Desktop (≥ 900 px):** painel de detalhe fixo à direita, dica de controles embaixo ("setas/WASD: slot · arrastar: girar · roda: zoom · Enter: selecionar"), mini-mapa 5×6 da grade no canto com o slot atual destacado.
- **Mobile (< 900 px):** painel de detalhe como "bottom sheet" que abre ao tocar num card; D-pad na tela (↑ ↓ ← →) no canto inferior; mini-mapa 5×6 compacto no topo; alvos de toque ≥ 44 px; gestos: arrastar gira, pinça dá zoom; respeita safe-area (notch) e orientação retrato.
- Estética do HUD: preto/vermelho/branco, `Bebas Neue` (títulos), `Space Grotesk` (texto), `Fira Code` (dados), mesmo da apresentação.

## Marcos
1. Pinata: upload das imagens, reescrita dos metadados, upload dos metadados, CIDs registrados.
2. Projeto Vite + cena PS1 + máquina vazia.
3. 30 cards nas posições A1–E6 com texturas.
4. Seleção, câmera e leitura dos metadados.
5. Estacionamento, iluminação baixa, movimentação com limite invisível.
6. HUD desktop e mobile.
7. Fluxo de pagamento (QR + carteira) em modo demo.
8. Deploy do contrato na Sepolia, verificação, conexão real e teste de compra.
9. Teste em Chrome desktop e emulação mobile; ajuste de desempenho.

## Fica a cargo de quem constrói
Proporções exatas da máquina, intensidade do efeito PS1, nomes de arquivos/módulos, estrutura de pastas interna, textos de dica do HUD.

## Pontos em aberto / riscos
- Nomes e descrições vêm dos JSONs; se mudarem depois do upload, será preciso novo upload (novo CID).
- Gateways IPFS podem ser lentos ou limitar requisições: por isso a lista de gateways com troca automática e o redimensionamento/cache das texturas. O gateway dedicado do Pinata exige o domínio; se não houver, usa-se só os públicos.
- Credenciais do Pinata foram coladas no chat; recomendar rotação ao final.
