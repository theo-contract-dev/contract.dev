import { loadConfig, resolveRpcUrl } from '../config';
import { callRpc } from '../rpc';
import { parseFlags, requirePositional, requireFlag, parseAmount } from './_args';

interface CodeResult { address: string; }
interface NonceResult { address: string; nonce: string; }
interface StorageResult { address: string; slot: string; }

const HELP = `contract.dev state — override on-chain state on your Stagenet

Usage:
  contract.dev state set-code <address> <bytecode>
  contract.dev state set-nonce <address> <nonce>
  contract.dev state set-storage <address> --slot <0x..> --value <0x..>

Notes:
  set-code accepts 0x-prefixed bytecode. Pass "0x" to wipe the code.
  set-nonce accepts a decimal or 0x-hex non-negative integer.
  set-storage requires both --slot and --value as 32-byte hex words
    (0x + 64 hex chars). Short hex like "0x42" is rejected — encode explicitly.
`;

export async function stateCommand(
  args: string[],
): Promise<CodeResult | NonceResult | StorageResult | void> {
  const [sub, ...rest] = args;

  switch (sub) {
    case 'set-code':
      return await setCodeSubcommand(rest);
    case 'set-nonce':
      return await setNonceSubcommand(rest);
    case 'set-storage':
      return await setStorageSubcommand(rest);
    case 'help':
    case '-h':
    case '--help':
    case undefined:
      console.log(HELP);
      return;
    default:
      console.error(`Unknown state subcommand: ${sub}\n`);
      console.error(HELP);
      process.exit(1);
  }
}

async function setCodeSubcommand(args: string[]): Promise<CodeResult> {
  const flags = parseFlags(args);
  const address = requirePositional(flags._, 0, 'address');
  const bytecode = requirePositional(flags._, 1, 'bytecode');
  if (!/^0x[0-9a-fA-F]*$/.test(bytecode)) {
    throw new Error('bytecode must be 0x-prefixed hex (use "0x" to wipe)');
  }

  const rpcUrl = resolveRpcUrl(loadConfig().config);
  const result = await callRpc<CodeResult>(rpcUrl, 'dev_setCode', [address, bytecode]);

  const len = (bytecode.length - 2) / 2;
  console.log(`Set code at ${result.address} (${len} byte${len === 1 ? '' : 's'})`);
  return result;
}

async function setNonceSubcommand(args: string[]): Promise<NonceResult> {
  const flags = parseFlags(args);
  const address = requirePositional(flags._, 0, 'address');
  const nonce = parseAmount(requirePositional(flags._, 1, 'nonce'), 'nonce');

  const rpcUrl = resolveRpcUrl(loadConfig().config);
  const result = await callRpc<NonceResult>(rpcUrl, 'dev_setNonce', [address, nonce]);

  console.log(`Set nonce for ${result.address} = ${result.nonce}`);
  return result;
}

async function setStorageSubcommand(args: string[]): Promise<StorageResult> {
  const flags = parseFlags(args);
  const address = requirePositional(flags._, 0, 'address');
  const slot = requireFlag(flags, 'slot');
  const value = requireFlag(flags, 'value');

  // Friendlier client-side error than the server's "32-byte hex word required".
  for (const [name, v] of [['--slot', slot], ['--value', value]] as const) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(v)) {
      throw new Error(
        `${name} must be a 32-byte hex word (0x + 64 hex chars). Got: ${v}\n` +
          `  Pad short hex explicitly: "0x" + n.toString(16).padStart(64, "0")`,
      );
    }
  }

  const rpcUrl = resolveRpcUrl(loadConfig().config);
  const result = await callRpc<StorageResult>(rpcUrl, 'dev_setStorageAt', [address, slot, value]);

  console.log(`Set storage at ${result.address}`);
  console.log(`  slot:  ${result.slot}`);
  console.log(`  value: ${value}`);
  return result;
}
