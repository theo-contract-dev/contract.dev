import { loadConfig, resolveRpcUrl as resolveUrlFromConfig } from '../config';
import { detectProject } from '../project';
import { loadArtifacts } from '../artifacts';
import { relPath } from '../format';
import { callRpc } from '../rpc';

interface ImportContractsResult {
  contracts: Array<{
    name: string;
    projectContractId: string;
    projectContractVersionId: string;
    status: 'created' | 'new_version' | 'unchanged';
  }>;
}

export async function importContractsCommand(): Promise<ImportContractsResult> {
  const { config, projectRoot } = loadConfig();

  const project = detectProject(projectRoot, config.contracts, config.artifacts);
  const typeLabel = project.type === 'foundry' ? 'Foundry' : 'Hardhat';
  const rootRel = relPath(projectRoot);
  console.log(`Detected ${typeLabel} project${rootRel === '.' ? '' : ` at ${rootRel}`}`);

  const { contracts } = loadArtifacts(project);
  if (contracts.length === 0) {
    console.error(
      `No deployable contracts found in ${relPath(project.artifactsDir)}. ` +
        `Every artifact was either an interface/abstract contract or sourced from outside ${relPath(project.sourceDir)}.`,
    );
    process.exit(1);
  }

  const rpcUrl = resolveUrlFromConfig(config);

  console.log(`Importing ${contracts.length} contract(s) to stagenet...\n`);
  const result = await callRpc<ImportContractsResult>(rpcUrl, 'dev_importContracts', [{ contracts }]);

  const nameWidth = Math.max(8, ...result.contracts.map((r) => r.name.length));
  for (const r of result.contracts) {
    const status = r.status === 'new_version' ? 'updated' : r.status;
    console.log(`  ${r.name.padEnd(nameWidth)}  ${status}`);
  }

  const created = result.contracts.filter((r) => r.status === 'created').length;
  const updated = result.contracts.filter((r) => r.status === 'new_version').length;
  const unchanged = result.contracts.filter((r) => r.status === 'unchanged').length;
  console.log(`\nContracts: ${created} created, ${updated} updated, ${unchanged} unchanged`);

  return result;
}
