import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
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
    throw new Error(
      `No artifacts found at ${project.artifactsDir}. ` +
        `Run \`${project.type === 'foundry' ? 'forge build' : 'npx hardhat compile'}\` first.`,
    );
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
