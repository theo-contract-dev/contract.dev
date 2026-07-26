import { parseFlags, requirePositional } from './_args';
import { apiRequest, loadCredentials, requireAuth, saveCredentials } from '../credentials';
import { WhoamiPayload } from './login';

const HELP = `contract.dev workspace — choose which workspace the CLI acts on

Usage:
  contract.dev workspace                 Show the active workspace
  contract.dev workspace list            List workspaces you belong to
  contract.dev workspace use <ref>       Switch (ref = slug, id, or name)

Your API key is account-level; the active workspace is a local setting sent with
each request (membership is checked server-side). CI can pick one per run with
CONTRACT_DEV_WORKSPACE instead.
`;

export async function workspaceCommand(args: string[]): Promise<void> {
  const [sub, ...rest] = args;
  switch (sub) {
    case undefined:
      return await showActive();
    case 'list':
      return await listWorkspaces();
    case 'use':
      return await useWorkspace(rest);
    case 'help':
    case '-h':
    case '--help':
      console.log(HELP);
      return;
    default:
      console.error(`Unknown workspace subcommand: ${sub}\n`);
      console.error(HELP);
      process.exit(1);
  }
}

async function showActive(): Promise<void> {
  const auth = requireAuth();
  const who = await apiRequest<WhoamiPayload>(auth, 'GET', '/api/cli/whoami');
  if (!who.org) {
    console.log('No active workspace resolved.');
    return;
  }
  console.log(`${who.org.name}${who.org.slug ? ` (${who.org.slug})` : ''}`);
}

async function listWorkspaces(): Promise<void> {
  const auth = requireAuth();
  const who = await apiRequest<WhoamiPayload>(auth, 'GET', '/api/cli/whoami');
  const workspaces = who.workspaces ?? [];
  if (!workspaces.length) {
    console.log('No workspaces found for this account.');
    return;
  }
  for (const workspace of workspaces) {
    const active = workspace.id === who.org?.id ? '*' : ' ';
    console.log(`${active} ${workspace.name}${workspace.slug ? `  (${workspace.slug})` : ''}`);
  }
}

async function useWorkspace(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const ref = requirePositional(flags._ as string[], 0, 'workspace (slug, id, or name)');

  const auth = requireAuth();
  const who = await apiRequest<WhoamiPayload>(auth, 'GET', '/api/cli/whoami');
  const workspaces = who.workspaces ?? [];
  const lowered = ref.toLowerCase();
  const match =
    workspaces.find((w) => w.slug === ref || w.id === ref) ??
    workspaces.find((w) => w.name.toLowerCase() === lowered);
  if (!match) {
    const available = workspaces.map((w) => w.slug ?? w.name).join(', ') || 'none';
    throw new Error(`No workspace matches "${ref}". Available: ${available}`);
  }

  const stored = loadCredentials();
  if (!stored) {
    throw new Error(
      'Credentials come from CONTRACT_DEV_API_KEY — set CONTRACT_DEV_WORKSPACE instead of `workspace use`.',
    );
  }
  saveCredentials({ ...stored, workspaceId: match.id, workspaceName: match.name });
  console.log(`Active workspace: ${match.name}${match.slug ? ` (${match.slug})` : ''}`);
}
