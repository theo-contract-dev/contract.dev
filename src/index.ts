type JsonRpcRequest = {
  jsonrpc: '2.0';
  method: string;
  params?: unknown[];
  id: number;
};

type JsonRpcResponse<T> = {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

// Shape of a contract.dev.js / contract.dev.cjs config file. The CLI reads it
// directly; the SDK reads it when createStagenet() is called with no arguments.
// Exported here so users can get IDE autocomplete via JSDoc:
//   /** @type {import('contract.dev').Config} */
//   module.exports = { rpcUrl: "..." };
export interface Config {
  rpcUrl?: string;
  // Override source dir. Auto-detected from foundry.toml / hardhat config if absent.
  contracts?: string;
  // Override compiled-artifacts dir. Auto-detected if absent.
  artifacts?: string;
}

export interface BalanceResult {
  address: string;
  balance: string;
}

export interface ERC20BalanceResult {
  tokenAddress: string;
  address: string;
  balance: string;
}

export interface CodeResult {
  address: string;
}

export interface NonceResult {
  address: string;
  nonce: string;
}

export interface StorageResult {
  address: string;
  slot: string;
}

// JSON-encoded ABI fragment (e.g. JSON.stringify({ type: 'function', name: 'balanceOf', ... }))
// or the ABI fragment object itself — the server accepts either form.
export type FunctionAbi = string | object;

export interface FunctionOverride {
  id: string;
  contractAddress: string;
  functionAbi: string;
  inputParams: string[] | null;
  returnValues: string[];
  enabled: boolean;
  createdAt: string;
}

export interface FunctionOverrideInput {
  contractAddress: string;
  functionAbi: FunctionAbi;
  // When omitted (or null/empty), the override is a wildcard for every call to that
  // selector on this contract. When set, the override only matches calls whose ABI-encoded
  // inputs match exactly — so the same selector can have different overrides per input.
  inputParams?: string[] | null;
  // String-encoded values matching the fragment's outputs (e.g. ['42'], ['0xabc...']).
  returnValues: string[];
}

export interface RemoveFunctionOverrideResult {
  id: string;
  removed: boolean;
}

// One of the four kinds of state the Stagenet can record over time. See
// https://docs.contract.dev/sdk-and-cli/sdk/state-tracking
export type TrackedItemType =
  | 'native-token-balance'
  | 'erc20-balance'
  | 'function-result'
  | 'storage-variable';

// How often the value should be recorded:
//   - 'every-tx' (default) — sample after every transaction
//   - 'every-n-blocks'     — sample every N blocks (requires `trackingFrequency`)
//   - 'cron'               — sample every N seconds (requires `trackingFrequency`)
export type RecordTrigger = 'every-tx' | 'every-n-blocks' | 'cron';

export interface TrackedItemInput {
  // The address the item is anchored to:
  //   - For 'native-token-balance' and 'storage-variable': the address whose balance / storage is read
  //   - For 'erc20-balance': the token contract address (holder goes in `functionArgs`)
  //   - For 'function-result': the contract whose view function is called
  address: string;
  name: string;
  type: TrackedItemType;
  // JSON-encoded ABI fragment, or a human-readable signature
  // (e.g. 'function totalSupply() view returns (uint256)').
  // Required for 'erc20-balance' and 'function-result'.
  functionAbi?: string;
  // JSON-encoded args array:
  //   - 'erc20-balance':   '["<holder>"]'
  //   - 'storage-variable': '["<32-byte slot hex>"]'
  //   - 'function-result':  '[<arg1>, <arg2>, ...]'
  functionArgs?: string;
  // Dot-separated path into a struct/tuple return value (e.g. 'info.balance').
  // Omit to store the full return value.
  functionOutputPath?: string;
  recordTrigger?: RecordTrigger;
  // Required when `recordTrigger` is 'every-n-blocks' (block count) or 'cron' (seconds).
  trackingFrequency?: number;
  tags?: string[];
}

export interface TrackedItem extends TrackedItemInput {
  id: string;
  createdAt?: string;
  decimals?: number | null;
  // Annotated onto each item when `getTrackedItems({ withValues: true })` is called.
  latestValue?: { value: string; blockNumber: number; timestamp: string } | null;
}

// Result of `addTrackedItem` — a thin "created" ack, not the full row.
// Call `getTrackedItems({ address })` if you need the full record back.
export interface CreatedTrackedItem {
  id: string;
  address: string;
  type: TrackedItemType;
  name: string;
}

export interface TrackedItemValue {
  value: string;
  blockNumber: number;
  timestamp: string;
  txHash: string;
}

// Relative time windows for `getTrackedItemValues`. The server returns values
// inside the window plus an optional `anchor` value just before the window
// starts (for charting continuity).
export type TrackedValuesPeriod = '10min' | '1h' | '1d' | '1w' | '1m';

export interface TrackedItemValuesResult {
  values: TrackedItemValue[];
  anchor?: TrackedItemValue;
}

export interface TrackedItemUpdates {
  name?: string;
  address?: string;
  type?: TrackedItemType;
  functionAbi?: string;
  functionArgs?: string;
  functionOutputPath?: string;
  recordTrigger?: RecordTrigger;
  trackingFrequency?: number;
  tags?: string[];
}

export interface RemoveTrackedItemResult {
  id: string;
  removed: boolean;
}

export interface GetTrackedItemsFilter {
  address?: string;
  tag?: string;
  // Annotate each returned item with its latest recorded value.
  withValues?: boolean;
}

// Input to `stagenet.addWorkspace`. The server auto-dispatches based on which
// fields you provide:
//   - `abi`                         → manual workspace (with or without address)
//   - `address` only, no on-chain code → wallet workspace
//   - `address` only, code matches mainnet → mainnet-contract workspace
//   - `address` only, code DOESN'T match mainnet → server returns an
//     actionable error pointing you at `--abi` or `push-contracts`.
// You never need to declare a "type" — the inputs alone determine the result.
export interface AddWorkspaceInput {
  // The address to attach the workspace to. Omit only for ABI-only manual
  // workspaces (where you have an ABI but no deployment yet).
  address?: string;
  // Display name shown in the dashboard.
  name: string;
  // Optional ABI as a JSON string. When provided, creates a manual workspace.
  abi?: string;
  // Optional UI hint for mainnet-contract workspaces. Ignored otherwise.
  type?: 'ERC20' | 'ERC721';
}

// Result of `stagenet.addWorkspace`. Discriminated by `kind` so callers can
// access the per-flavor fields. The discriminator also tells you which flow
// the server picked when you let it auto-detect.
export type AddWorkspaceResult =
  | { kind: 'wallet'; wallet: { id: string; name: string | null; address: string; createdAt: string } }
  | { kind: 'mainnet-contract'; mainnetProjectContract: { id: string; name: string; address: string; type: string | null; createdAt: string } }
  | {
      kind: 'manual';
      projectContract: { id: string; name: string };
      projectContractVersion: { id: string };
      projectContractDeployment: { id: string; address: string } | null;
    };

export class Stagenet {
  readonly rpcUrl: string;

  constructor(rpcUrl: string) {
    if (typeof rpcUrl !== 'string' || rpcUrl.length === 0) {
      throw new Error(
        `createStagenet requires a non-empty rpcUrl string (got ${JSON.stringify(rpcUrl)}). ` +
          `Pass no argument to load the URL from contract.dev.{js,cjs} instead.`,
      );
    }
    this.rpcUrl = rpcUrl;
  }

  // Add native token balance to an account (additive, no tx, no gas).
  addBalance(address: string, amount: string | bigint | number): Promise<BalanceResult> {
    return this.call('dev_addBalance', [address, normalizeAmount(amount)]);
  }

  // Overwrite native token balance on an account (no tx, no gas).
  setBalance(address: string, amount: string | bigint | number): Promise<BalanceResult> {
    return this.call('dev_setBalance', [address, normalizeAmount(amount)]);
  }

  // Add ERC20 balance to an account (additive). Writes the balanceOf storage slot.
  addERC20Balance(
    address: string,
    tokenAddress: string,
    amount: string | bigint | number,
  ): Promise<ERC20BalanceResult> {
    return this.call('dev_addERC20Balance', [address, tokenAddress, normalizeAmount(amount)]);
  }

  // Overwrite ERC20 balance on an account. Writes the balanceOf storage slot.
  setERC20Balance(
    address: string,
    tokenAddress: string,
    amount: string | bigint | number,
  ): Promise<ERC20BalanceResult> {
    return this.call('dev_setERC20Balance', [address, tokenAddress, normalizeAmount(amount)]);
  }

  // Set the code at an address. Pass '0x' to clear.
  setCode(address: string, bytecode: string): Promise<CodeResult> {
    return this.call('dev_setCode', [address, bytecode]);
  }

  // Set the nonce on an account.
  setNonce(address: string, nonce: string | bigint | number): Promise<NonceResult> {
    return this.call('dev_setNonce', [address, normalizeAmount(nonce)]);
  }

  // Set a storage slot at an address. Both `slot` and `value` must be exact
  // 32-byte hex words (`0x` + 64 hex chars). Short inputs are rejected — encode
  // explicitly (e.g. `"0x" + n.toString(16).padStart(64, "0")`).
  setStorageAt(address: string, slot: string, value: string): Promise<StorageResult> {
    return this.call('dev_setStorageAt', [address, slot, value]);
  }

  // Mark an account as impersonated — eth_sendTransaction from this address
  // will be accepted without a signature. See https://docs.contract.dev/tools/impersonate
  impersonateAccount(address: string): Promise<boolean> {
    return this.call('dev_impersonateAccount', [address]);
  }

  // Stop impersonating an account.
  stopImpersonatingAccount(address: string): Promise<boolean> {
    return this.call('dev_stopImpersonatingAccount', [address]);
  }

  // List currently-impersonated accounts (lowercased).
  getImpersonatedAccounts(): Promise<string[]> {
    return this.call('dev_getImpersonatedAccounts', []);
  }

  // Override the return value of a contract function. Affects both `eth_call`
  // and nested EVM call frames (a contract that staticcall's this one sees the
  // override too). Pass `inputParams` to scope the override to a specific input;
  // omit for a wildcard that matches every call to the selector. Exact-input
  // overrides take precedence over wildcards.
  // See https://docs.contract.dev/tools/function-overrides
  addFunctionOverride(input: FunctionOverrideInput): Promise<FunctionOverride> {
    return this.call('dev_addFunctionOverride', [input]);
  }

  // Replace the returnValues of an existing override. The contract address, selector
  // and inputParams are immutable — remove and re-add to change them.
  updateFunctionOverride(id: string, returnValues: string[]): Promise<FunctionOverride> {
    return this.call('dev_updateFunctionOverride', [id, returnValues]);
  }

  // Delete an override.
  removeFunctionOverride(id: string): Promise<RemoveFunctionOverrideResult> {
    return this.call('dev_removeFunctionOverride', [id]);
  }

  // Toggle an override on without changing its definition.
  enableFunctionOverride(id: string): Promise<FunctionOverride> {
    return this.call('dev_enableFunctionOverride', [id]);
  }

  // Toggle an override off without removing it.
  disableFunctionOverride(id: string): Promise<FunctionOverride> {
    return this.call('dev_disableFunctionOverride', [id]);
  }

  // List every override on this stagenet (most recent first).
  getFunctionOverrides(): Promise<FunctionOverride[]> {
    return this.call('dev_getFunctionOverrides', []);
  }

  // List overrides for a specific contract address.
  getFunctionOverridesByContract(contractAddress: string): Promise<FunctionOverride[]> {
    return this.call('dev_getFunctionOverridesByContract', [contractAddress]);
  }

  // Add a Workspace (per-address dashboard) without the bulk artifact-upload
  // flow. The server auto-dispatches based on inputs — see AddWorkspaceInput.
  // If you pass `address` for a contract that lives only on your Stagenet (not
  // mainnet) and don't include `abi`, the server returns an actionable error
  // pointing you at `--abi` or `push-contracts`.
  addWorkspace(input: AddWorkspaceInput): Promise<AddWorkspaceResult> {
    return this.call('dev_addWorkspace', [input]);
  }

  // Record a piece of on-chain state over time. The Stagenet snapshots its value
  // on the cadence set by `recordTrigger` (defaults to 'every-tx') and the history
  // shows up in the corresponding Workspace.
  // See https://docs.contract.dev/sdk-and-cli/sdk/state-tracking
  addTrackedItem(item: TrackedItemInput): Promise<CreatedTrackedItem> {
    return this.call('dev_addTrackedData', [item]);
  }

  // Delete a tracked item and its recorded history.
  removeTrackedItem(id: string): Promise<RemoveTrackedItemResult> {
    return this.call('dev_removeTrackedData', [id]);
  }

  // Update a tracked item. Changing a "semantic" field (type, address, abi,
  // args, output path) clears the item's recorded history server-side so old
  // and new values don't mix on the same chart.
  updateTrackedItem(id: string, updates: TrackedItemUpdates): Promise<TrackedItem> {
    return this.call('dev_updateTrackedData', [id, updates]);
  }

  // List tracked items on this stagenet.
  //   - `{ address }`     — items anchored to a specific contract
  //   - `{ tag }`         — items with a given tag
  //   - `{ withValues: true }` — annotate each item with its `latestValue`
  // No filter returns every tracked item.
  getTrackedItems(filter?: GetTrackedItemsFilter): Promise<TrackedItem[]> {
    return this.call('dev_getTrackedData', filter ? [filter] : []);
  }

  // Read recorded values for a tracked item. Pass `{ period }` for a relative
  // window — the server also returns an `anchor` value just before the window
  // for chart continuity. Pass `{ maxBlockNumber }` for values up to and
  // including a specific block.
  getTrackedItemValues(
    id: string,
    options?: { period?: TrackedValuesPeriod; maxBlockNumber?: number },
  ): Promise<TrackedItemValuesResult> {
    return this.call('dev_getTrackedDataValues', options ? [id, options] : [id]);
  }

  private async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    };

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`RPC request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as JsonRpcResponse<T>;
    if (payload.error) {
      throw new Error(payload.error.message || 'RPC error');
    }
    return payload.result as T;
  }
}

function normalizeAmount(amount: string | bigint | number): string {
  return BigInt(amount).toString();
}

// Construct a Stagenet client.
//
// - `createStagenet(url)` — explicit URL. Works in any environment (Node, browser, Edge).
// - `createStagenet()` — auto-loads `contract.dev.{js,cjs}` from the current
//   working directory (walking up the tree). Node-only — the config loader uses `fs`.
//
// Only `undefined` triggers the no-args / config-file path. Passing `null` or
// the empty string is treated as a malformed explicit URL and throws — that
// way `createStagenet(process.env.RPC_URL ?? "")` fails fast instead of
// silently using whatever's in contract.dev.{js,cjs}.
export function createStagenet(rpcUrl?: string): Stagenet {
  if (rpcUrl !== undefined) return new Stagenet(rpcUrl);
  // Lazy `require` so browser bundlers don't try to bundle Node's `fs` on the
  // explicit-URL path. Only the no-args call touches the filesystem.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { loadConfig, resolveRpcUrl } = require('./cli/config');
  const { config } = loadConfig();
  return new Stagenet(resolveRpcUrl(config));
}

export default createStagenet;
