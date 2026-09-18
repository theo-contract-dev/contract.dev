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
import { watchCommand, unwatchCommand, renameCommand } from './commands/watch';
import { metricsCommand, trackCommand, untrackCommand } from './commands/metrics';
import { monitorCommand, monitorsCommand, channelsCommand } from './commands/monitor';
import { incidentsCommand } from './commands/incidents';
import { extractTargetFlags } from './target';

const HELP = `contract.dev — your contracts, from the command line

Account:
  contract.dev login                      Connect the CLI to your contract.dev account (try: login help)
  contract.dev whoami                     Show which account + workspace the CLI acts as
  contract.dev workspace <sub>            Show/switch the active workspace (try: workspace help)
  contract.dev logout                     Delete the saved credentials

Watch contracts:
  contract.dev watch <address>            Watch a mainnet contract (try: watch help)
  contract.dev watch list                 List watched contracts
  contract.dev rename <address> <name>    Rename a watched contract
  contract.dev unwatch <address>          Stop watching a contract

Metrics:
  contract.dev metrics                    List tracked metrics (try: metrics help)
  contract.dev track <address> <kind>     Track a balance, supply, call result, TVL or method telemetry (try: track help)
  contract.dev untrack <id|label>         Stop tracking

Monitoring:
  contract.dev monitors                   List monitors
  contract.dev monitor add <metric> …     Alert when a metric crosses a line (try: monitor help)
  contract.dev incidents                  What fired (try: incidents help)
  contract.dev channels                   Alert destinations

Stagenets:
  contract.dev stagenets                  List the active workspace's stagenets
  contract.dev stagenet use <name>        Set the active stagenet (stored per workspace)
  --stagenet <name> / --rpc-url <url>     One-off target override on any stagenet command
  contract.dev push-contracts             Push this directory's compiled contracts (creates/updates Workspaces)
  contract.dev generate-wallet            Generate a fresh wallet and fund it with 1,000,000 native tokens
  contract.dev balance <sub>              Change native balances (try: balance help)
  contract.dev erc20-balance <sub>        Change ERC20 balances (try: erc20-balance help)
  contract.dev state <sub>                Override code / nonce / storage (try: state help)
  contract.dev impersonate <sub>          Impersonate an address (try: impersonate help)
  contract.dev follow <sub>               Pin contract state to live mainnet (try: follow help)
  contract.dev unfollow <address>         Stop following (mirrors follow's flags)
  contract.dev function-override <sub>    Override contract function results (try: function-override help)

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
    case 'rename':
      await renameCommand(rest);
      return;
    case 'metrics':
      await metricsCommand(rest);
      return;
    case 'track':
      await trackCommand(rest);
      return;
    case 'untrack':
      await untrackCommand(rest);
      return;
    case 'monitors':
      await monitorsCommand(rest);
      return;
    case 'monitor':
      await monitorCommand(rest);
      return;
    case 'incidents':
      await incidentsCommand(rest);
      return;
    case 'channels':
      await channelsCommand(rest);
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
