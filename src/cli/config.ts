import { existsSync } from 'node:fs';
import { dirname, join, parse as parsePath, resolve } from 'node:path';

export interface FileConfig {
  rpcKey?: string;
  rpcUrl?: string;
  // Override source dir. Auto-detected from foundry.toml / hardhat config if absent.
  contracts?: string;
  // Override compiled-artifacts dir. Auto-detected if absent (Foundry `out`,
  // Hardhat `<paths.artifacts>/<paths.sources>`). Useful when the auto-detected
  // path is wrong — e.g. a Hardhat config that computes paths dynamically.
  artifacts?: string;
}

export interface LoadedConfig {
  config: FileConfig;
  configPath: string;
  projectRoot: string;
}

const CONFIG_FILENAMES = ['contract.dev.js', 'contract.dev.cjs'];

export function findConfigFile(startDir: string): string | null {
  let dir = resolve(startDir);
  const root = parsePath(dir).root;
  while (true) {
    for (const name of CONFIG_FILENAMES) {
      const p = join(dir, name);
      if (existsSync(p)) return p;
    }
    if (dir === root) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(cwd: string = process.cwd()): LoadedConfig {
  const configPath = findConfigFile(cwd);
  if (!configPath) {
    throw new Error(
      'No contract.dev.{js,cjs} found in this directory or any parent. ' +
        'Run `contract.dev init` to create one.',
    );
  }

  // Clear the require cache so an edited config is picked up on reload.
  delete require.cache[require.resolve(configPath)];
  let mod: any;
  try {
    mod = require(configPath);
  } catch (e) {
    throw new Error(`Failed to load ${configPath}: ${e instanceof Error ? e.message : e}`);
  }
  const raw = mod?.default ?? mod;

  if (!raw || typeof raw !== 'object') {
    throw new Error(`${configPath} must export an object (e.g. module.exports = { rpcUrl: "..." })`);
  }

  const config = raw as FileConfig;
  if (!config.rpcKey && !config.rpcUrl) {
    throw new Error(`${configPath} is missing "rpcUrl"`);
  }
  if (isPlaceholder(config.rpcUrl) || isPlaceholder(config.rpcKey)) {
    throw new Error(
      `Your ${configPath} still has a placeholder. ` +
        'Edit it and set "rpcUrl" to your Stagenet URL ' +
        '(copy it from your project dashboard at https://contract.dev).',
    );
  }

  return {
    config,
    configPath,
    projectRoot: dirname(configPath),
  };
}

// A value like `<YOUR_STAGENET_URL>` written by `contract.dev init` and not yet replaced.
function isPlaceholder(value: string | undefined): boolean {
  return !!value && value.startsWith('<') && value.endsWith('>');
}

// Compose the full RPC URL from a config. `rpcUrl` takes precedence; otherwise
// build it from `rpcKey` against the contract.dev base.
export function resolveRpcUrl(config: FileConfig): string {
  if (config.rpcUrl) return config.rpcUrl;
  if (config.rpcKey) return `https://rpc.contract.dev/${config.rpcKey}`;
  throw new Error('Config is missing "rpcUrl" or "rpcKey"');
}
