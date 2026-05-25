import { loadConfig, resolveRpcUrl } from '../config';
import { callRpc } from '../rpc';

// Schema mirrors packages/client/src/types/tracked-items.ts on the backend.
interface TrackedItem {
  address: string;
  name: string;
  type: 'native-token-balance' | 'erc20-balance' | 'function-result' | 'storage-variable';
  functionAbi?: string;
  functionArgs?: string;
  functionOutputPath?: string;
  recordTrigger?: 'every-tx' | 'every-n-blocks' | 'cron';
  trackingFrequency?: number;
  tags?: string[];
}

interface StoredTrackedItem extends TrackedItem {
  id: string;
  createdAt?: string;
  decimals?: number | null;
  latestValue?: { value: string; blockNumber: number; timestamp: string } | null;
}

const HELP = `contract.dev track — record on-chain state over time

Usage:
  contract.dev track add balance <address> --name <name> [options]
  contract.dev track add erc20 <token> <holder> --name <name> [options]
  contract.dev track add storage <address> --slot <0x...> --name <name> [options]
  contract.dev track add function <address> --abi <abi> --args <json> [--output-path <p>] --name <name> [options]
  contract.dev track list [--address <addr>] [--tag <tag>] [--with-values]
  contract.dev track values <id> [--period 10min|1h|1d|1w|1m]
  contract.dev track remove <id>
  contract.dev track update <id> [--name <name>] [--tags a,b] [--trigger ...] [--frequency <n>]

Common options:
  --trigger <every-tx|every-n-blocks|cron>   When to record. Defaults to every-tx.
  --frequency <n>                            Block count (every-n-blocks) or seconds (cron).
  --tags <a,b,c>                             Comma-separated tags to attach.

Notes:
  --abi accepts either a JSON ABI fragment or a human-readable signature
    e.g. 'function totalSupply() view returns (uint256)'
  --args is a JSON array, e.g. '["0xabc..."]' or '[]'
`;

export async function trackCommand(args: string[]): Promise<void> {
  const [sub, ...rest] = args;

  switch (sub) {
    case 'add':
      await addSubcommand(rest);
      return;
    case 'list':
      await listSubcommand(rest);
      return;
    case 'values':
      await valuesSubcommand(rest);
      return;
    case 'remove':
    case 'rm':
      await removeSubcommand(rest);
      return;
    case 'update':
      await updateSubcommand(rest);
      return;
    case 'help':
    case '-h':
    case '--help':
    case undefined:
      console.log(HELP);
      return;
    default:
      console.error(`Unknown track subcommand: ${sub}\n`);
      console.error(HELP);
      process.exit(1);
  }
}

// --- ADD ---

async function addSubcommand(args: string[]): Promise<void> {
  const [kind, ...rest] = args;
  if (!kind) {
    console.error('Missing tracked-item kind. Expected: balance | erc20 | storage | function');
    process.exit(1);
  }

  const rpcUrl = resolveRpcUrl(loadConfig().config);
  const flags = parseFlags(rest);
  const positional = flags._;

  const common = readCommonAddFlags(flags);

  let item: TrackedItem;
  switch (kind) {
    case 'balance': {
      const address = requirePositional(positional, 0, 'address');
      item = {
        type: 'native-token-balance',
        address,
        name: common.name ?? `balance ${short(address)}`,
        ...common.shared,
      };
      break;
    }

    case 'erc20': {
      const tokenAddress = requirePositional(positional, 0, 'token address');
      const holder = requirePositional(positional, 1, 'holder address');
      item = {
        type: 'erc20-balance',
        address: tokenAddress,
        name: common.name ?? `erc20 ${short(tokenAddress)} -> ${short(holder)}`,
        functionAbi: JSON.stringify(ERC20_BALANCE_OF_ABI),
        functionArgs: JSON.stringify([holder]),
        ...common.shared,
      };
      break;
    }

    case 'storage': {
      const address = requirePositional(positional, 0, 'address');
      const slot = requireFlag(flags, 'slot');
      const slotHex = normalizeSlot(slot);
      item = {
        type: 'storage-variable',
        address,
        name: common.name ?? `storage ${short(address)} @ ${shortSlot(slotHex)}`,
        functionArgs: JSON.stringify([slotHex]),
        ...common.shared,
      };
      break;
    }

    case 'function': {
      const address = requirePositional(positional, 0, 'address');
      const abi = requireFlag(flags, 'abi');
      const argsJson = flag(flags, 'args') ?? '[]';
      // Validate the JSON now so the user gets a clear error instead of a server-side one.
      try {
        const parsed = JSON.parse(argsJson);
        if (!Array.isArray(parsed)) throw new Error('not an array');
      } catch (e) {
        throw new Error(`--args must be a JSON array (got: ${argsJson})`);
      }
      const outputPath = flag(flags, 'output-path');
      item = {
        type: 'function-result',
        address,
        name: common.name ?? `function ${short(address)}`,
        functionAbi: abi,
        functionArgs: argsJson,
        ...(outputPath ? { functionOutputPath: outputPath } : {}),
        ...common.shared,
      };
      break;
    }

    default:
      console.error(`Unknown tracked-item kind: ${kind}. Expected: balance | erc20 | storage | function`);
      process.exit(1);
  }

  const result = await callRpc<{ id: string; address: string; type: string; name: string }>(
    rpcUrl,
    'dev_addTrackedData',
    [item],
  );
  console.log(`Created tracked item ${result.id}`);
  console.log(`  type:    ${item.type}`);
  console.log(`  address: ${item.address}`);
  console.log(`  name:    ${item.name}`);
  if (item.recordTrigger) console.log(`  trigger: ${item.recordTrigger}${item.trackingFrequency ? ` (freq ${item.trackingFrequency})` : ''}`);
  if (item.tags?.length) console.log(`  tags:    ${item.tags.join(', ')}`);
}

// --- LIST ---

async function listSubcommand(args: string[]): Promise<void> {
  const rpcUrl = resolveRpcUrl(loadConfig().config);
  const flags = parseFlags(args);
  const withValues = flags['with-values'] === 'true' || args.includes('--with-values');

  const filter: { address?: string; tag?: string; withValues?: boolean } = {};
  const address = flag(flags, 'address');
  const tag = flag(flags, 'tag');
  if (address) filter.address = address;
  if (tag) filter.tag = tag;
  if (withValues) filter.withValues = true;

  const items = await callRpc<StoredTrackedItem[]>(rpcUrl, 'dev_getTrackedData', [filter]);

  if (items.length === 0) {
    console.log('No tracked items.');
    return;
  }

  for (const it of items) {
    const tags = it.tags?.length ? ` [${it.tags.join(', ')}]` : '';
    const latest = it.latestValue ? `  latest=${it.latestValue.value}@${it.latestValue.blockNumber}` : '';
    console.log(`${it.id}  ${it.type.padEnd(20)}  ${it.address}  ${it.name}${tags}${latest}`);
  }
}

// --- VALUES ---

async function valuesSubcommand(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const id = requirePositional(flags._, 0, 'tracked item id');
  const period = flags['period'] as '10min' | '1h' | '1d' | '1w' | '1m' | undefined;
  if (period && !['10min', '1h', '1d', '1w', '1m'].includes(period)) {
    throw new Error(`--period must be one of 10min, 1h, 1d, 1w, 1m`);
  }

  const rpcUrl = resolveRpcUrl(loadConfig().config);
  const result = await callRpc<{ values: Array<{ value: string; blockNumber: number; timestamp: string; txHash: string }>; anchor?: unknown }>(
    rpcUrl,
    'dev_getTrackedDataValues',
    period ? [id, { period }] : [id],
  );

  if (!result.values || result.values.length === 0) {
    console.log('No recorded values yet.');
    return;
  }

  for (const v of result.values) {
    console.log(`${v.timestamp}  block ${v.blockNumber}  ${v.value}`);
  }
  console.log(`\n${result.values.length} value(s).`);
}

// --- REMOVE ---

async function removeSubcommand(args: string[]): Promise<void> {
  const id = requirePositional(parseFlags(args)._, 0, 'tracked item id');
  const rpcUrl = resolveRpcUrl(loadConfig().config);
  await callRpc<{ id: string; removed: boolean }>(rpcUrl, 'dev_removeTrackedData', [id]);
  console.log(`Removed tracked item ${id}`);
}

// --- UPDATE ---

async function updateSubcommand(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const id = requirePositional(flags._, 0, 'tracked item id');

  const updates: Record<string, unknown> = {};
  const name = flag(flags, 'name');
  const address = flag(flags, 'address');
  const abi = flag(flags, 'abi');
  const argsVal = flag(flags, 'args');
  const outputPath = flag(flags, 'output-path');
  const trigger = flag(flags, 'trigger');
  const frequency = flag(flags, 'frequency');
  const tags = flag(flags, 'tags');
  if (name !== undefined) updates.name = name;
  if (address !== undefined) updates.address = address;
  if (abi !== undefined) updates.functionAbi = abi;
  if (argsVal !== undefined) updates.functionArgs = argsVal;
  if (outputPath !== undefined) updates.functionOutputPath = outputPath;
  if (trigger !== undefined) updates.recordTrigger = validateTrigger(trigger);
  if (frequency !== undefined) updates.trackingFrequency = parsePositiveInt(frequency, 'frequency');
  if (tags !== undefined) updates.tags = parseTags(tags);

  if (Object.keys(updates).length === 0) {
    throw new Error('No update fields provided.');
  }

  const rpcUrl = resolveRpcUrl(loadConfig().config);
  await callRpc(rpcUrl, 'dev_updateTrackedData', [id, updates]);
  console.log(`Updated tracked item ${id}`);
}

// --- helpers ---

const ERC20_BALANCE_OF_ABI = {
  type: 'function',
  name: 'balanceOf',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
};

// `_` holds positional args; named flags use bracket lookup elsewhere.
interface ParsedFlags {
  _: string[];
  // Indexed access returns string | undefined; we don't produce arrays.
  [key: string]: string | string[] | undefined;
}

function flag(flags: ParsedFlags, name: string): string | undefined {
  const v = flags[name];
  return typeof v === 'string' ? v : undefined;
}

// Tiny flag parser. Supports --key=value and --key value. Booleans (--flag with
// no value) come back as 'true'. Anything not preceded by --flag is positional.
function parseFlags(args: string[]): ParsedFlags {
  const out: ParsedFlags = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq >= 0) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = args[i + 1];
        if (next && !next.startsWith('--')) {
          out[a.slice(2)] = next;
          i++;
        } else {
          out[a.slice(2)] = 'true';
        }
      }
    } else {
      (out._ as string[]).push(a);
    }
  }
  return out;
}

function requirePositional(positional: string[], idx: number, label: string): string {
  const v = positional[idx];
  if (!v) throw new Error(`Missing required ${label}`);
  return v;
}

function requireFlag(flags: ParsedFlags, name: string): string {
  const v = flags[name];
  if (typeof v !== 'string' || v.length === 0 || v === 'true') {
    throw new Error(`Missing required --${name}`);
  }
  return v;
}

function readCommonAddFlags(flags: ParsedFlags): {
  name: string | undefined;
  shared: { recordTrigger?: 'every-tx' | 'every-n-blocks' | 'cron'; trackingFrequency?: number; tags?: string[] };
} {
  const triggerRaw = flag(flags, 'trigger');
  const frequencyRaw = flag(flags, 'frequency');
  const tagsRaw = flag(flags, 'tags');
  const nameRaw = flag(flags, 'name');

  const trigger = triggerRaw ? validateTrigger(triggerRaw) : undefined;
  const frequency = frequencyRaw ? parsePositiveInt(frequencyRaw, 'frequency') : undefined;
  const tags = tagsRaw ? parseTags(tagsRaw) : undefined;

  if ((trigger === 'every-n-blocks' || trigger === 'cron') && frequency === undefined) {
    throw new Error(`--trigger ${trigger} requires --frequency`);
  }

  return {
    name: nameRaw && nameRaw !== 'true' ? nameRaw : undefined,
    shared: {
      ...(trigger ? { recordTrigger: trigger } : {}),
      ...(frequency !== undefined ? { trackingFrequency: frequency } : {}),
      ...(tags ? { tags } : {}),
    },
  };
}

function validateTrigger(v: string): 'every-tx' | 'every-n-blocks' | 'cron' {
  if (v === 'every-tx' || v === 'every-n-blocks' || v === 'cron') return v;
  throw new Error(`--trigger must be one of every-tx, every-n-blocks, cron (got: ${v})`);
}

function parsePositiveInt(v: string, label: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`--${label} must be a positive integer (got: ${v})`);
  }
  return n;
}

function parseTags(v: string): string[] {
  return v
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// Storage slot must be a 32-byte hex word. Accept short hex (e.g. "0x0") and pad.
function normalizeSlot(raw: string): string {
  if (!/^0x[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(`--slot must be hex (0x...). Got: ${raw}`);
  }
  const body = raw.slice(2).toLowerCase();
  if (body.length > 64) throw new Error(`--slot is longer than 32 bytes: ${raw}`);
  return '0x' + body.padStart(64, '0');
}

function short(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function shortSlot(slot: string): string {
  return slot.length > 14 ? `${slot.slice(0, 8)}…${slot.slice(-4)}` : slot;
}
