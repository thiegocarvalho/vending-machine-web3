require('@nomicfoundation/hardhat-toolbox');
const fs = require('fs');
if (fs.existsSync('.env')) {
  for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];
module.exports = {
  solidity: { version: '0.8.24', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' } },
  paths: { tests: './test/hardhat' },
  networks: { sepolia: { url: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com', accounts } },
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY || '' }
};
