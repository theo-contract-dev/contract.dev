import { parseFlags, flag, requirePositional } from './_args';
import { apiRequest, requireAuth, ResolvedAuth } from '../credentials';

const HELP = `contract.dev watch — watch mainnet contracts on your workspace's dashboard

Usage:
  contract.dev watch <address> [flags]                 Watch a contract
  contract.dev watch list [--chain <id>]               List watched contracts
  contract.dev rename <address> <name> [--chain <id>]  Rename a watched contract (clears with "")
  contract.dev unwatch <address> [--chain <id>]        Stop watching a contract

Flags (watch <address>):
  --chain <id>     Chain the contract lives on (default: 1)
  --name <label>   Display name. Omit to use the detected one (the token's name(),
                   else its verified Etherscan name); change it later with rename.

Contracts are watched per (chain, address) — \`--chain\` disambiguates one watched
on several chains. Watched contracts appear on the home map and /contracts.
Requires \`contract.dev login\`.
`;

// The unified shape returned by the app's watchlist API. The API also holds watched
// wallets in this shape; the CLI is contracts-only and filters them out everywhere.
export interface WatchedAccount {
  id: string;
  chainId: number;
  chainIds: number[];
  address: string;
  accountType: 'contract' | 'wallet';
  name: string | null;
  contractType?: string | null;
  valueUsd?: number | null;
}

interface Detection {
  accountType: 'contract' | 'wallet';
  detectedName: string | null;
  contractType: string | null;
}

export function parseChainId(raw: string, label: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive chain id (got: ${raw})`);
  return value;
}

export function describeAccount(account: WatchedAccount): string {
  return account.name ? `${account.name} (${account.address})` : account.address;
}

// Resolve one watched contract from an address (+ optional chain). Contracts are
// per-(chain, address), so --chain disambiguates. Shared by unwatch / rename and by the
// metric commands that name a subject.
export async function findWatchedAccount(
  auth: ResolvedAuth,
  address: string,
  chainId: number | undefined,
): Promise<WatchedAccount> {
  const lower = address.toLowerCase();
  const { accounts } = await apiRequest<{ accounts: WatchedAccount[] }>(auth, 'GET', '/api/mainnet/accounts?accountType=contract');
  const matches = (accounts ?? []).filter(
    (a) => a.accountType === 'contract' && a.address.toLowerCase() === lower && (chainId === undefined || a.chainId === chainId),
  );
  if (matches.length === 0) {
    throw new Error(`No watched contract found for ${address}${chainId !== undefined ? ` on chain ${chainId}` : ''}`);
  }
  if (matches.length > 1) {
    const chains = matches.map((m) => m.chainId).join(', ');
    throw new Error(`${address} is watched on chains ${chains}. Disambiguate with --chain.`);
  }
  return matches[0];
}

export async function watchCommand(args: string[]): Promise<unknown> {
  const [sub] = args;
  switch (sub) {
    case 'list':
      return await listSubcommand(args.slice(1));
    case 'rename':
      return await renameCommand(args.slice(1));
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

// The modal's flow: detect first (type + name), then add with the result as hints so the
// server classifies once. A wallet is refused here, before any row exists.
async function addSubcommand(args: string[]): Promise<WatchedAccount> {
  const flags = parseFlags(args);
  const address = requirePositional(flags._ as string[], 0, 'address');
  const chainId = parseChainId(flag(flags, 'chain') ?? '1', '--chain');
  const name = flag(flags, 'name');

  const auth = requireAuth();
  const detected = await apiRequest<Detection>(auth, 'POST', '/api/mainnet/accounts/detect', { chainId, address });
  if (detected.accountType !== 'contract') {
    throw new Error(`${address} has no code on chain ${chainId} — it's a wallet. The CLI watches contracts; add wallets in the app.`);
  }

  const label = name?.trim() || detected.detectedName || undefined;
  const payload = await apiRequest<{ account: WatchedAccount; created: boolean }>(auth, 'POST', '/api/mainnet/accounts', {
    chainId,
    address,
    accountType: 'contract',
    ...(detected.contractType ? { contractType: detected.contractType } : {}),
    ...(label ? { name: label } : {}),
  });

  const account = payload.account;
  console.log(`${payload.created ? 'Watching' : 'Updated'} ${describeAccount(account)} on chain ${account.chainId}`);
  return account;
}

async function listSubcommand(args: string[]): Promise<WatchedAccount[]> {
  const flags = parseFlags(args);
  const chainRaw = flag(flags, 'chain');
  const query = chainRaw ? `&chainId=${parseChainId(chainRaw, '--chain')}` : '';

  const auth = requireAuth();
  const { accounts } = await apiRequest<{ accounts: WatchedAccount[] }>(auth, 'GET', `/api/mainnet/accounts?accountType=contract${query}`);
  const contracts = (accounts ?? []).filter((a) => a.accountType === 'contract');
  if (!contracts.length) {
    console.log('No watched contracts.');
    return [];
  }
  for (const account of contracts) {
    console.log(`${String(account.chainId).padEnd(8)} ${account.address}${account.name ? `  ${account.name}` : ''}`);
  }
  return contracts;
}

// `contract.dev rename <address> <name>` — the same PATCH the register's rename uses, so
// the name lands in the org address book too (every AccountCell in the app agrees).
export async function renameCommand(args: string[]): Promise<WatchedAccount | void> {
  if (args[0] === 'help' || args[0] === '-h' || args[0] === '--help' || args[0] === undefined) {
    console.log(HELP);
    return;
  }
  const flags = parseFlags(args);
  const positional = flags._ as string[];
  const address = requirePositional(positional, 0, 'address');
  // "" is a legitimate value here (clear the name), so don't go through requirePositional.
  if (positional.length < 2) throw new Error('Missing required name (pass "" to clear it)');
  const name = positional.slice(1).join(' ').trim();
  const chainRaw = flag(flags, 'chain');
  const chainId = chainRaw === undefined ? undefined : parseChainId(chainRaw, '--chain');

  const auth = requireAuth();
  const target = await findWatchedAccount(auth, address, chainId);
  const { account } = await apiRequest<{ account: WatchedAccount }>(auth, 'PATCH', `/api/mainnet/accounts/${target.id}`, {
    name,
  });
  if (account.name) console.log(`Renamed ${account.address} to "${account.name}".`);
  else console.log(`Cleared the name on ${account.address}.`);
  return account;
}

export async function unwatchCommand(args: string[]): Promise<void> {
  if (args[0] === 'help' || args[0] === '-h' || args[0] === '--help' || args[0] === undefined) {
    console.log(HELP);
    return;
  }
  const flags = parseFlags(args);
  const address = requirePositional(flags._ as string[], 0, 'address');
  const chainRaw = flag(flags, 'chain');
  const chainId = chainRaw === undefined ? undefined : parseChainId(chainRaw, '--chain');

  const auth = requireAuth();
  const target = await findWatchedAccount(auth, address, chainId);
  await apiRequest(auth, 'DELETE', `/api/mainnet/accounts/${target.id}`);
  console.log(`Stopped watching ${describeAccount(target)}.`);
}
