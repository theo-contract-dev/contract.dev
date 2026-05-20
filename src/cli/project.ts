import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type ProjectType = 'foundry' | 'hardhat';

export interface ProjectInfo {
  type: ProjectType;
  // Absolute path to project root (where foundry.toml or hardhat.config.* live).
  root: string;
  // Absolute path to where user-authored contracts live (e.g. src/ or contracts/).
  sourceDir: string;
  // Absolute path to where compiled artifacts live (e.g. out/ or artifacts/contracts/).
  artifactsDir: string;
}

const HH_CONFIG_NAMES = [
  'hardhat.config.ts',
  'hardhat.config.js',
  'hardhat.config.cjs',
  'hardhat.config.mjs',
];

export function detectProject(
  projectRoot: string,
  sourceOverride?: string,
  artifactsOverride?: string,
): ProjectInfo {
  const root = resolve(projectRoot);

  if (existsSync(join(root, 'foundry.toml'))) {
    const { src, out } = parseFoundryToml(join(root, 'foundry.toml'));
    return {
      type: 'foundry',
      root,
      sourceDir: resolve(root, sourceOverride ?? src ?? 'src'),
      artifactsDir: resolve(root, artifactsOverride ?? out ?? 'out'),
    };
  }

  const hhConfigPath = HH_CONFIG_NAMES.map((n) => join(root, n)).find((p) => existsSync(p));
  if (hhConfigPath) {
    const { sources, artifacts } = parseHardhatConfig(hhConfigPath);
    const sourcesRel = sourceOverride ?? sources ?? 'contracts';
    // Hardhat lays artifacts out as <paths.artifacts>/<sources-relative-to-root>/.
    // For defaults (sources=contracts, artifacts=artifacts) → artifacts/contracts/.
    // When sources is overridden (e.g. "src") → artifacts/src/.
    // The manual `artifacts:` override takes the literal path as-is.
    const artifactsBase = artifacts ?? 'artifacts';
    return {
      type: 'hardhat',
      root,
      sourceDir: resolve(root, sourcesRel),
      artifactsDir: artifactsOverride
        ? resolve(root, artifactsOverride)
        : resolve(root, artifactsBase, sourcesRel),
    };
  }

  throw new Error(
    `No Foundry (foundry.toml) or Hardhat (hardhat.config.{ts,js,cjs,mjs}) project detected in ${root}`,
  );
}

// Minimal foundry.toml parser — we only need [profile.default].src and .out.
// Full TOML is unnecessary and adds a dep; this handles the keys we care about.
function parseFoundryToml(path: string): { src?: string; out?: string } {
  const raw = readFileSync(path, 'utf8');
  const lines = raw.split('\n');
  let inDefaultProfile = false;
  let src: string | undefined;
  let out: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\[(.+?)\]$/);
    if (sectionMatch) {
      const section = sectionMatch[1].trim();
      inDefaultProfile = section === 'profile.default' || section === 'default';
      continue;
    }

    if (!inDefaultProfile) continue;

    const kv = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim().replace(/^["']|["']$/g, '');

    if (key === 'src') src = value;
    if (key === 'out') out = value;
  }

  return { src, out };
}

// Best-effort parse of hardhat.config.{ts,js,cjs,mjs} for `paths.sources` and
// `paths.artifacts`. Avoids actually requiring the config (which would pull in
// hardhat + ts-node + plugins). Strips line/block comments first so commented-out
// settings don't trigger false matches. For configs that compute paths dynamically
// the user can set `artifacts` / `contracts` in contract.dev.{js,cjs}.
function parseHardhatConfig(configPath: string): { sources?: string; artifacts?: string } {
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch {
    return {};
  }

  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const sourcesMatch = stripped.match(/\bsources\s*:\s*['"]([^'"]+)['"]/);
  const artifactsMatch = stripped.match(/\bartifacts\s*:\s*['"]([^'"]+)['"]/);
  return {
    sources: sourcesMatch?.[1],
    artifacts: artifactsMatch?.[1],
  };
}
