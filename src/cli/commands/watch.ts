import { parseFlags, flag, requirePositional } from './_args';
import { apiRequest, requireAuth } from '../credentials';

const HELP = `contract.dev watch — watch mainnet contracts and wallets on your workspace's dashboard

Usage:
  contract.dev watch <address> [flags]           Watch an address (contract vs wallet auto-detected)
  contract.dev watch list [--chain <id>]         List watched accounts
  contract.dev unwatch <address> [--chain <id>]  Archive a watched account

Flags (watch <address>):
  --chain <id>     Chain to watch a contract on / detection anchor (default: 1)
  --name <label>   Display name
  --chains <ids>   Wallet chain membership, comma-separated (e.g. 1,8453,42161).
                   Omit to let the server detect where the wallet is active.

Watched accounts appear on the home map and /accounts. Requires
\`contract.dev login\` (or CONTRACT_DEV_API_KEY).
`;

// The unified shape returned by the app's watchlist API.
interface WatchedAccount {
  id: string;
  chainId: number;
  chainIds: number[];
  address: string;
  accountType: 'contract' | 'wallet';
  name: string | null;
  valueUsd?: number | null;
}

function parseChainId(raw: string, label: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive chain id (got: ${raw})`);
  return value;
}

export async function watchCommand(args: string[]): Promise<unknown> {
  const [sub] = args;
  switch (sub) {
    case 'list':
      return await listSubcommand(args.slice(1));
    case 'help':
    case '-h':
    case '--help':
    case undefined:
      console.log(HELP);
      return;
    default:
      return await addSubcommand(args);
  }
}

async function addSubcommand(args: string[]): Promise<WatchedAccount> {
  const flags = parseFlags(args);
  const address = requirePositional(flags._ as string[], 0, 'address');
  const chainId = parseChainId(flag(flags, 'chain') ?? '1', '--chain');
  const name = flag(flags, 'name');
  const chainsRaw = flag(flags, 'chains');
  const chainIds = chainsRaw ? chainsRaw.split(',').map((c) => parseChainId(c.trim(), '--chains entry')) : undefined;

  const auth = requireAuth();
  const payload = await apiRequest<{ account: WatchedAccount; created: boolean }>(auth, 'POST', '/api/mainnet/accounts', {
    chainId,
    address,
    ...(name ? { name } : {}),
    ...(chainIds ? { chainIds } : {}),
  });

  const account = payload.account;
  const chains = (account.chainIds?.length ? account.chainIds : [account.chainId]).join(', ');
  const label = account.name ? `${account.name} (${account.address})` : account.address;
  console.log(
    `${payload.created ? 'Watching' : 'Updated'} ${account.accountType} ${label} on chain${chains.includes(',') ? 's' : ''} ${chains}`,
  );
  return account;
}

async function listSubcommand(args: string[]): Promise<WatchedAccount[]> {
  const flags = parseFlags(args);
  const chainRaw = flag(flags, 'chain');
  const query = chainRaw ? `?chainId=${parseChainId(chainRaw, '--chain')}` : '';

  const auth = requireAuth();
  const { accounts } = await apiRequest<{ accounts: WatchedAccount[] }>(auth, 'GET', `/api/mainnet/accounts${query}`);
  if (!accounts?.length) {
    console.log('No watched accounts.');
    return [];
  }
  for (const account of accounts) {
    const chains = (account.chainIds?.length ? account.chainIds : [account.chainId]).join(',');
    console.log(
      `${account.accountType.padEnd(9)} ${chains.padEnd(14)} ${account.address}${account.name ? `  ${account.name}` : ''}`,
    );
  }
  return accounts;
}

export async function unwatchCommand(args: string[]): Promise<void> {
  if (args[0] === 'help' || args[0] === '-h' || args[0] === '--help' || args[0] === undefined) {
    console.log(HELP);
    return;
  }
  const flags = parseFlags(args);
  const address = requirePositional(flags._ as string[], 0, 'address').toLowerCase();
  const chainRaw = flag(flags, 'chain');
  const chainId = chainRaw === undefined ? undefined : parseChainId(chainRaw, '--chain');

  const auth = requireAuth();
  const { accounts } = await apiRequest<{ accounts: WatchedAccount[] }>(auth, 'GET', '/api/mainnet/accounts');
  // Contracts are per-(chain, address); wallets are one org-wide entry, so --chain
  // only disambiguates contracts.
  const matches = (accounts ?? []).filter(
    (a) =>
      a.address.toLowerCase() === address &&
      (a.accountType === 'wallet' || chainId === undefined || a.chainId === chainId),
  );
  if (matches.length === 0) {
    throw new Error(`No watched account found for ${address}${chainId !== undefined ? ` on chain ${chainId}` : ''}`);
  }
  if (matches.length > 1) {
    const description = matches.map((m) => `${m.accountType} on chain ${m.chainId}`).join('; ');
    throw new Error(`Multiple watched accounts match ${address}: ${description}. Disambiguate with --chain.`);
  }

  await apiRequest(auth, 'DELETE', `/api/mainnet/accounts/${matches[0].id}`);
  const label = matches[0].name ? `${matches[0].name} (${matches[0].address})` : matches[0].address;
  console.log(`Stopped watching ${matches[0].accountType} ${label} (archived).`);
}
