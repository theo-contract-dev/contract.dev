#!/usr/bin/env node
import { initCommand } from './commands/init';
import { pushContractsCommand } from './commands/push-contracts';
import { generateWalletCommand } from './commands/generate-wallet';
import { trackCommand } from './commands/track';
import { functionOverrideCommand } from './commands/function-override';
import { balanceCommand, erc20BalanceCommand } from './commands/balance';
import { stateCommand } from './commands/state';
import { impersonateCommand } from './commands/impersonate';
import { workspaceCommand } from './commands/workspace';

const HELP = `contract.dev — work with your stagenet from the command line

Setup:
  contract.dev init                       Create a contract.dev.js in the current directory
  contract.dev init --rpc-url=<url>       Init with your Stagenet URL filled in
  contract.dev init --force               Overwrite an existing contract.dev.{js,cjs}
  contract.dev push-contracts             Push compiled contracts to your Stagenet (creates/updates Workspaces)
  contract.dev workspace add <address>    Attach a Workspace to an address (auto-detects wallet/mainnet/manual)
  contract.dev generate-wallet            Generate a fresh wallet and fund it with 1,000,000 native tokens

Stagenet state:
  contract.dev balance <sub>              Change native balances (try: balance help)
  contract.dev erc20-balance <sub>        Change ERC20 balances (try: erc20-balance help)
  contract.dev state <sub>                Override code / nonce / storage (try: state help)
  contract.dev impersonate <sub>          Impersonate an address (try: impersonate help)

Behavior overrides:
  contract.dev function-override <sub>    Override contract function results (try: function-override help)

Observability:
  contract.dev track <sub>                Record on-chain state over time (try: track help)

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
    case 'push-contracts':
      await pushContractsCommand();
      return;
    case 'generate-wallet':
      await generateWalletCommand();
      return;
    case 'track':
      await trackCommand(rest);
      return;
    case 'function-override':
      await functionOverrideCommand(rest);
      return;
    case 'balance':
      await balanceCommand(rest);
      return;
    case 'erc20-balance':
      await erc20BalanceCommand(rest);
      return;
    case 'state':
      await stateCommand(rest);
      return;
    case 'impersonate':
      await impersonateCommand(rest);
      return;
    case 'workspace':
      await workspaceCommand(rest);
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
