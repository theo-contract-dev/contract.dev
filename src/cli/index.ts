#!/usr/bin/env node
import { pushContractsCommand } from './commands/push-contracts';
import { generateWalletCommand } from './commands/generate-wallet';
import { functionOverrideCommand } from './commands/function-override';
import { balanceCommand, erc20BalanceCommand } from './commands/balance';
import { stateCommand } from './commands/state';
import { impersonateCommand } from './commands/impersonate';
import { followCommand, unfollowCommand } from './commands/follow';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/login';
import { workspaceCommand } from './commands/workspace';
import { stagenetCommand, stagenetsCommand } from './commands/stagenet';
import { watchCommand, unwatchCommand } from './commands/watch';
import { extractTargetFlags } from './target';

const HELP = `contract.dev — work with your stagenets from the command line

Account:
  contract.dev login                      Connect the CLI to your contract.dev account (try: login help)
  contract.dev whoami                     Show which account + workspace the CLI acts as
  contract.dev workspace <sub>            Show/switch the active workspace (try: workspace help)
  contract.dev logout                     Delete the saved credentials

Stagenet targeting:
  contract.dev stagenets                  List the active workspace's stagenets
  contract.dev stagenet use <name>        Set the active stagenet (stored per workspace)
  --stagenet <name> / --rpc-url <url>     One-off target override on any stagenet command

Stagenet state:
  contract.dev balance <sub>              Change native balances (try: balance help)
  contract.dev erc20-balance <sub>        Change ERC20 balances (try: erc20-balance help)
  contract.dev state <sub>                Override code / nonce / storage (try: state help)
  contract.dev impersonate <sub>          Impersonate an address (try: impersonate help)
  contract.dev follow <sub>               Pin contract state to live mainnet (try: follow help)
  contract.dev unfollow <address>         Stop following (mirrors follow's flags)

Contracts + tools:
  contract.dev push-contracts             Push this directory's compiled contracts (creates/updates Workspaces)
  contract.dev generate-wallet            Generate a fresh wallet and fund it with 1,000,000 native tokens
  contract.dev function-override <sub>    Override contract function results (try: function-override help)

Mainnet watchlist:
  contract.dev watch <address>            Watch a mainnet contract or wallet (try: watch help)
  contract.dev unwatch <address>          Archive a watched account

  contract.dev help                       Show this help
`;

async function main() {
  const args = extractTargetFlags(process.argv.slice(2));
  const [cmd, ...rest] = args;

  switch (cmd) {
    case 'push-contracts':
      await pushContractsCommand(rest);
      return;
    case 'import-contracts': // pre-rename spelling, kept as a quiet alias
      console.error('Note: `import-contracts` is now `push-contracts`.');
      await pushContractsCommand(rest);
      return;
    case 'generate-wallet':
      await generateWalletCommand();
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
    case 'follow':
      await followCommand(rest);
      return;
    case 'unfollow':
      await unfollowCommand(rest);
      return;
    case 'login':
      await loginCommand(rest);
      return;
    case 'logout':
      await logoutCommand();
      return;
    case 'whoami':
      await whoamiCommand();
      return;
    case 'workspace':
      await workspaceCommand(rest);
      return;
    case 'stagenets':
      await stagenetsCommand();
      return;
    case 'stagenet':
      await stagenetCommand(rest);
      return;
    case 'watch':
      await watchCommand(rest);
      return;
    case 'unwatch':
      await unwatchCommand(rest);
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
