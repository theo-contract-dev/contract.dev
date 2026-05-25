import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, parse as parsePath, resolve } from 'node:path';
import { relPath } from '../format';

const PLACEHOLDER = '<YOUR_STAGENET_RPC_URL>';

function template(url: string): string {
  return `/** @type {import('contract.dev').Config} */
module.exports = {
  rpcUrl: "${url}",
};
`;
}

// True when the nearest package.json (walking up from cwd) declares "type": "module".
// In ESM projects, a `.js` file can't be require()'d — Node throws
// "Must use import to load ES Module". So we write `.cjs` to keep the loader simple.
function isEsmProject(startDir: string): boolean {
  let dir = resolve(startDir);
  const root = parsePath(dir).root;
  while (true) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        return pkg.type === 'module';
      } catch {
        return false;
      }
    }
    if (dir === root) return false;
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

export async function initCommand(args: string[]): Promise<void> {
  const force = args.includes('--force') || args.includes('-f');
  const rpcUrlArg = args.find((a) => a.startsWith('--rpc-url='))?.slice('--rpc-url='.length);

  const url = rpcUrlArg && rpcUrlArg.length > 0 ? rpcUrlArg : PLACEHOLDER;
  const cwd = process.cwd();
  const ext = isEsmProject(cwd) ? 'cjs' : 'js';
  const path = resolve(cwd, `contract.dev.${ext}`);

  // Refuse if either variant already exists (avoid creating both side-by-side).
  const existingPath = ['contract.dev.js', 'contract.dev.cjs']
    .map((n) => resolve(cwd, n))
    .find((p) => existsSync(p));

  if (existingPath && !force) {
    console.error(`${relPath(existingPath)} already exists`);
    console.error('Use --force to overwrite.');
    process.exit(1);
  }

  writeFileSync(existingPath ?? path, template(url));

  console.log(`Created ${relPath(existingPath ?? path)}`);
  if (url === PLACEHOLDER) {
    console.log(`Edit it and replace ${PLACEHOLDER} with your Stagenet RPC URL`);
    console.log('(copy it from your project dashboard at https://contract.dev).');
  }
}
