import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { relPath } from './format';
import type { ProjectInfo } from './project';

export interface LocalContract {
  name: string;
  abi: string;
  bytecode: string;
  creationBytecode?: string;
  deployedBytecode?: string;
  sourcePath?: string;
  storageLayout?: unknown;
  bytecodeLinkReferences?: unknown;
  deployedBytecodeLinkReferences?: unknown;
}

export interface ArtifactsResult {
  contracts: LocalContract[];
  // Names of artifacts we skipped (interfaces, libraries with empty bytecode, etc.).
  skipped: Array<{ name: string; reason: string }>;
}

export function loadArtifacts(project: ProjectInfo): ArtifactsResult {
  if (!existsSync(project.artifactsDir)) {
    throw new Error(buildMissingArtifactsError(project));
  }

  const contracts: LocalContract[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  const jsonFiles = walkJsonFiles(project.artifactsDir);

  for (const file of jsonFiles) {
    const parsed = parseArtifact(file, project);
    if (!parsed) continue;

    // Drop artifacts whose source isn't inside the user's source dir
    // (e.g. node_modules dependencies, OZ base contracts).
    // sourcePath is always relative to the project root for both HH and Foundry.
    if (parsed.sourcePath) {
      const absSource = resolve(project.root, parsed.sourcePath);
      const fromSourceDir = relative(project.sourceDir, absSource);
      if (fromSourceDir.startsWith('..')) {
        continue;
      }
    }

    // Skip interfaces / abstract contracts — they have no runtime bytecode to version.
    if (!parsed.bytecode || parsed.bytecode === '0x' || parsed.bytecode.length <= 2) {
      skipped.push({ name: parsed.name, reason: 'no bytecode (interface/abstract)' });
      continue;
    }

    contracts.push(parsed);
  }

  return { contracts, skipped };
}

function walkJsonFiles(dir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkJsonFiles(full));
    } else if (entry.endsWith('.json') && !entry.endsWith('.dbg.json')) {
      out.push(full);
    }
  }
  return out;
}

function parseArtifact(file: string, project: ProjectInfo): LocalContract | null {
  let json: any;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }

  if (project.type === 'foundry') {
    // Foundry: { abi, bytecode: { object }, deployedBytecode: { object }, metadata: { settings: { compilationTarget } }, ... }
    // Skip Foundry build-info / cache files that don't look like contract artifacts.
    if (!json.abi || !json.bytecode) return null;

    const name = guessFoundryName(file, json);
    const creationBytecode = typeof json.bytecode?.object === 'string' ? json.bytecode.object : '';
    const deployedBytecode =
      typeof json.deployedBytecode?.object === 'string' ? json.deployedBytecode.object : '';

    const sourcePath = json.metadata?.settings?.compilationTarget
      ? Object.keys(json.metadata.settings.compilationTarget)[0]
      : undefined;

    return {
      name,
      abi: JSON.stringify(json.abi),
      bytecode: deployedBytecode || creationBytecode,
      creationBytecode: creationBytecode || undefined,
      deployedBytecode: deployedBytecode || undefined,
      sourcePath,
      storageLayout: json.storageLayout,
      bytecodeLinkReferences: json.bytecode?.linkReferences,
      deployedBytecodeLinkReferences: json.deployedBytecode?.linkReferences,
    };
  }

  // Hardhat v2: _format = "hh-sol-artifact-1"
  // Hardhat v3: _format = "hh3-artifact-1" (same field layout, plus immutableReferences/inputSourceName/buildInfoId)
  if (json._format !== 'hh-sol-artifact-1' && json._format !== 'hh3-artifact-1') return null;
  if (!json.abi || !json.contractName) return null;

  const creationBytecode = typeof json.bytecode === 'string' ? json.bytecode : '';
  const deployedBytecode = typeof json.deployedBytecode === 'string' ? json.deployedBytecode : '';

  return {
    name: json.contractName,
    abi: JSON.stringify(json.abi),
    bytecode: deployedBytecode || creationBytecode,
    creationBytecode: creationBytecode || undefined,
    deployedBytecode: deployedBytecode || undefined,
    sourcePath: json.sourceName,
    bytecodeLinkReferences: json.linkReferences,
    deployedBytecodeLinkReferences: json.deployedLinkReferences,
  };
}

// Multi-line, source-aware error for the "artifacts dir doesn't exist" case.
// We tailor the advice based on whether the resolved paths came from
// contract.dev.js, from a successful regex match on the project's config, or
// from a hard-coded default — because each one calls for different remediation.
//
// For Hardhat in particular, `artifactsDir` is composed from BOTH `paths.sources`
// (subpath) and `paths.artifacts` (base), so a default fallback on either one
// can produce a wrong final path. We trigger the "dynamic paths" advice when
// either is on the default.
function buildMissingArtifactsError(project: ProjectInfo): string {
  const buildCmd = project.type === 'foundry' ? 'forge build' : 'npx hardhat compile';
  const lines: string[] = [`No artifacts found at ${relPath(project.artifactsDir)}.`];

  const anyOverride =
    project.sourceDirSource === 'override' || project.artifactsDirSource === 'override';
  const anyDefault =
    project.sourceDirSource === 'default' || project.artifactsDirSource === 'default';

  if (anyOverride) {
    // User explicitly set `contracts:` and/or `artifacts:` in contract.dev.js.
    // Either they pointed at the wrong dir, or they haven't built yet.
    lines.push(
      `This path uses the "${project.artifactsDirSource === 'override' ? 'artifacts' : 'contracts'}" override from your contract.dev.{js,cjs}.`,
      `Either fix it to point at where ${project.type === 'foundry' ? 'forge' : 'hardhat'} writes artifacts,`,
      `or run \`${buildCmd}\` first.`,
    );
  } else if (project.type === 'hardhat' && anyDefault) {
    // Hardhat config parser is regex-only — any computed/env-driven path in
    // hardhat.config shows up as "default" here even though the user set one.
    // Surface that ambiguity directly so the user doesn't have to guess why
    // the wrong dir was used.
    const which: string[] = [];
    if (project.sourceDirSource === 'default') which.push('`paths.sources`');
    if (project.artifactsDirSource === 'default') which.push('`paths.artifacts`');
    lines.push(
      `The CLI couldn't statically read ${which.join(' and ')} from your hardhat.config`,
      `(the parser only matches quoted string literals — computed values, env vars, and imports are invisible),`,
      `so it fell back to the Hardhat default${which.length > 1 ? 's' : ''}.`,
      ``,
      `If your hardhat.config sets ${which.join(' or ')} dynamically,`,
      `set them in your contract.dev.{js,cjs} — it's a regular Node module, so the same`,
      `env vars, path.join calls, and imports work there:`,
      ``,
      `    const path = require("path");`,
      `    const SRC = process.env.CONTRACTS_DIR || "src/protocol";`,
      `    module.exports = {`,
      `      rpcUrl: "...",`,
      `      contracts: SRC,                              // your paths.sources`,
      `      artifacts: path.join("build/artifacts", SRC), // paths.artifacts + sources subpath`,
      `    };`,
      ``,
      `Otherwise, run \`${buildCmd}\` first.`,
      `See https://docs.contract.dev/sdk-and-cli/cli/push-contracts#dynamic-paths`,
    );
  } else {
    // Foundry default, or every path came from the config and just needs a build.
    lines.push(`Run \`${buildCmd}\` first.`);
  }

  return lines.join('\n');
}

function guessFoundryName(file: string, json: any): string {
  // Foundry stores artifacts as out/<File.sol>/<ContractName>.json
  // Prefer the contract name from the path (filename without .json), but
  // fall back to compilationTarget value if needed.
  const base = file.split('/').pop()!.replace(/\.json$/, '');
  if (base && !base.includes('.')) return base;
  const target = json.metadata?.settings?.compilationTarget;
  if (target) {
    const first = Object.values(target)[0];
    if (typeof first === 'string') return first;
  }
  return base;
}
