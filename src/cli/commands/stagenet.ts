import { parseFlags, requirePositional } from './_args';
import { loadCredentials, saveCredentials } from '../credentials';
import { activeStagenetFor, fetchStagenets, matchStagenet, StagenetsPayload, StagenetSummary } from '../target';

const HELP = `contract.dev stagenet — choose which stagenet the CLI targets

Usage:
  contract.dev stagenets                 List the active workspace's stagenets
  contract.dev stagenet                  Show the active stagenet
  contract.dev stagenet use <ref>        Set it (ref = name or id; stored per workspace)

Any stagenet command also takes a one-off override:
  --stagenet <name>       Resolve a name via the API instead of the active one
  --rpc-url <url>         Hit an RPC URL directly (no login needed; CI: CONTRACT_DEV_RPC_URL)
`;

function describeChain(stagenet: StagenetSummary): string {
  return stagenet.forkChainId ? `fork of ${stagenet.forkChainId}` : 'no fork chain';
}

function resolveActive(payload: StagenetsPayload): StagenetSummary | undefined {
  const active = activeStagenetFor(payload.workspace?.id);
  if (!active) return undefined;
  return (
    payload.stagenets.find((s) => s.id === active.id) ??
    payload.stagenets.find((s) => s.name.toLowerCase() === active.name.toLowerCase())
  );
}

export async function stagenetsCommand(): Promise<StagenetSummary[]> {
  const payload = await fetchStagenets();
  if (!payload.stagenets.length) {
    console.log('No stagenets in this workspace yet — create one in the dashboard.');
    return [];
  }
  const activeId = resolveActive(payload)?.id;
  for (const stagenet of payload.stagenets) {
    const marker = stagenet.id === activeId ? '*' : ' ';
    const offline = stagenet.rpcUrl ? '' : '  (offline)';
    console.log(`${marker} ${stagenet.name}  — ${describeChain(stagenet)}${offline}`);
  }
  return payload.stagenets;
}

export async function stagenetCommand(args: string[]): Promise<void> {
  const [sub, ...rest] = args;
  switch (sub) {
    case undefined:
      return await showActive();
    case 'use':
      return await useStagenet(rest);
    case 'list':
      await stagenetsCommand();
      return;
    case 'help':
    case '-h':
    case '--help':
      console.log(HELP);
      return;
    default:
      console.error(`Unknown stagenet subcommand: ${sub}\n`);
      console.error(HELP);
      process.exit(1);
  }
}

async function showActive(): Promise<void> {
  const payload = await fetchStagenets();
  const active = resolveActive(payload);
  if (!active) {
    const available = payload.stagenets.map((s) => s.name).join(', ') || 'none yet';
    console.log(`No active stagenet. Set one with \`contract.dev stagenet use <name>\`. Available: ${available}`);
    return;
  }
  console.log(`${active.name}  — ${describeChain(active)}${active.rpcUrl ? '' : '  (offline)'}`);
  if (active.rpcUrl) console.log(`  rpc: ${active.rpcUrl}`);
}

async function useStagenet(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const ref = requirePositional(flags._ as string[], 0, 'stagenet (name or id)');

  const payload = await fetchStagenets();
  const target = matchStagenet(payload.stagenets, ref);
  const workspaceId = payload.workspace?.id;
  if (!workspaceId) throw new Error('Could not resolve the active workspace.');

  const stored = loadCredentials();
  if (!stored) {
    throw new Error(
      'Signed in via environment credentials — set CONTRACT_DEV_STAGENET instead of `stagenet use`.',
    );
  }
  saveCredentials({
    ...stored,
    activeStagenets: { ...stored.activeStagenets, [workspaceId]: { id: target.id, name: target.name } },
  });
  console.log(`Active stagenet: ${target.name}  — ${describeChain(target)}${target.rpcUrl ? '' : '  (offline)'}`);
}
