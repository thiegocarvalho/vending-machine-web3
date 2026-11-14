# Deploy na Sepolia com a sua carteira

A chave privada **nunca** vai no chat nem em arquivo `.env`: ela fica num keystore cifrado por senha (`keystore/deployer.json`, ignorado pelo git).

## 1. Preparar (uma vez)
1. Crie uma carteira **só para deploy** (não use a carteira principal): `npm run wallet:new` (gera uma) ou `npm run wallet:import` (cola a chave de uma que você já tem, com entrada oculta). Escolha uma senha forte.
2. `npm run wallet:address` mostra o endereço. Peça ETH de teste num faucet Sepolia (veja `docs/06`). `npm run wallet:balance` confere.
3. No `.env` (copie de `.env.example` se existir), preencha:
   - `ETHERSCAN_API_KEY` (verificação automática do contrato)
   - opcionais: `SEPOLIA_RPC_URL` (RPC seu; padrão público), `ROYALTY_RECEIVER` (padrão: o deployer), `ROYALTY_BPS` (padrão 500 = 5%, máx. 1000), `DEFAULT_PRICE_ETH` (padrão 0.0001), `FINAL_OWNER` (transfere a posse ao fim; o novo dono precisa chamar `acceptOwnership`).
4. Antes, corrija nos metadados o que o deploy avisar (`external_url`, royalties do `contractURI`) e suba de novo no Pinata se mudar (novo CID em `ipfs-cids.json`).

## 2. Ensaiar (não gasta nada)
`npm run deploy:dry` mostra rede, quem assina, dono, royalties, preço, custo estimado e saldo, e confere os metadados no IPFS. Para aqui.

## 3. Deploy de verdade
`npm run deploy:sepolia` repete o resumo, pede a senha e uma confirmação digitada (`sepolia`), faz o deploy, relê 9 valores do contrato, grava `deployments.json` e **preenche `game/.env.production`**, e verifica no Etherscan (com novas tentativas). Mainnet é bloqueada no script.

## 4. Publicar o jogo
Veja o README de `game/` ("Publicar").

## Testes
`npm test` (todos) · `npx hardhat test` (on-chain + ferramentas de deploy).
