const env = import.meta.env ?? {};

export const config = {
  chainId: 11155111,
  contractAddress: env.VITE_CONTRACT_ADDRESS || '',
  metadataCid: env.VITE_METADATA_CID || '',
  rpcUrl: env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
  gateways: [
    ...(env.VITE_PINATA_GATEWAY ? [`https://${env.VITE_PINATA_GATEWAY}/ipfs/`] : []),
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.filebase.io/ipfs/'
  ],
  get demoMode() { return !this.contractAddress; },
  wallRadius: 7,
  pixelScale: 3
};
