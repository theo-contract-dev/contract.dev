import { loadConfig, resolveRpcUrl as resolveUrlFromConfig } from '../config';
import { detectProject } from '../project';
import { loadArtifacts } from '../artifacts';
import { callRpc } from '../rpc';

interface UploadResult {
  contracts: Array<{
    name: string;
    projectContractId: string;
    projectContractVersionId: string;
    status: 'created' | 'new_version' | 'unchanged';
  }>;
}

export async function uploadContractsCommand(): Promise<UploadResult> {
  const { config, projectRoot } = loadConfig();

  const project = detectProject(projectRoot, config.contracts, config.artifacts);
  console.log(`Detected ${project.type} project at ${projectRoot}`);
  console.log(`  source:    ${project.sourceDir}`);
  console.log(`  artifacts: ${project.artifactsDir}`);

  const { contracts, skipped } = loadArtifacts(project);
  if (contracts.length === 0) {
    console.error('No deployable contracts found in artifacts. Did you build the project?');
    if (skipped.length > 0) {
      console.error(`(${skipped.length} artifact(s) were skipped — interfaces/abstract.)`);
    }
    process.exit(1);
  }

  console.log(`\nFound ${contracts.length} contract(s):`);
  for (const c of contracts) {
    console.log(`  - ${c.name}${c.sourcePath ? ` (${c.sourcePath})` : ''}`);
  }

  const rpcUrl = resolveUrlFromConfig(config);

  console.log('\nUploading to stagenet...');
  const result = await callRpc<UploadResult>(rpcUrl, 'dev_importContracts', [{ contracts }]);

  console.log('\nResult:');
  const nameWidth = Math.max(8, ...result.contracts.map((r) => r.name.length));
  for (const r of result.contracts) {
    console.log(`  ${r.name.padEnd(nameWidth)}  ${r.status}`);
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped ${skipped.length} artifact(s):`);
    for (const s of skipped) {
      console.log(`  - ${s.name} (${s.reason})`);
    }
  }

  return result;
}
