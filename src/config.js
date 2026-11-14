const env = import.meta.env ?? {};

export const config = {
  chainId: Number(env.VITE_CHAIN_ID) || 11155111,
  chainName: env.VITE_CHAIN_NAME || 'Sepolia',
  explorer: env.VITE_EXPLORER_URL ?? 'https://sepolia.etherscan.io',
  contractAddress: env.VITE_CONTRACT_ADDRESS || '',
  metadataCid: env.VITE_METADATA_CID || '',
  rpcUrl: env.VITE_RPC_URL || env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
  gateways: [
    ...(env.VITE_PINATA_GATEWAY ? [`https://${env.VITE_PINATA_GATEWAY}/ipfs/`] : []),
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.filebase.io/ipfs/'
  ],
  get demoMode() { return !this.contractAddress; },
  faucetUrl: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia',   // faucet do Google (Sepolia)
  wallRadius: 7
};
