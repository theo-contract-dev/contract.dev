#!/usr/bin/env node
import { initCommand } from './commands/init';
import { uploadContractsCommand } from './commands/upload-contracts';
import { generateWalletCommand } from './commands/generate-wallet';

const HELP = `contract.dev — work with your stagenet from the command line

Usage:
  contract.dev init                       Create a contract.dev.js in the current directory
  contract.dev init --rpc-url=<url>       Init with your Stagenet URL filled in
  contract.dev upload-contracts           Upload HH/Foundry artifacts as project contracts
  contract.dev generate-wallet            Generate a fresh wallet and fund it with 1,000,000 native tokens
  contract.dev help                       Show this help

Config: contract.dev.js (or .cjs) in the project root.
  module.exports = { rpcUrl: "https://rpc.contract.dev/<your-key>" }
`;

async function main() {
  const [, , cmd, ...rest] = process.argv;

  switch (cmd) {
    case 'init':
      await initCommand(rest);
      return;
    case 'upload-contracts':
      await uploadContractsCommand();
      return;
    case 'generate-wallet':
      await generateWalletCommand();
      return;
    case 'help':
    case '-h':
    case '--help':
    case undefined:
      console.log(HELP);
      return;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.error(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
