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
  rpcKey?: string;
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

export class Stagenet {
  readonly rpcUrl: string;

  constructor(rpcUrl: string) {
    if (typeof rpcUrl !== 'string' || rpcUrl.length === 0) {
      throw new Error('createStagenet requires an rpcUrl string');
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
export function createStagenet(rpcUrl?: string): Stagenet {
  if (rpcUrl) return new Stagenet(rpcUrl);
  // Lazy `require` so browser bundlers don't try to bundle Node's `fs` on the
  // explicit-URL path. Only the no-args call touches the filesystem.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { loadConfig, resolveRpcUrl } = require('./cli/config');
  const { config } = loadConfig();
  return new Stagenet(resolveRpcUrl(config));
}

export default createStagenet;
