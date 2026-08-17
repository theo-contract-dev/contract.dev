import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_API_URL = 'https://app.contract.dev';

// Saved by `contract.dev login`, per-user per-machine (never in the repo). The
// key is account-level; workspaceId/Name record the ACTIVE workspace the CLI
// acts on (switch with `contract.dev workspace use`).
export interface StoredCredentials {
  apiKey: string;
  apiUrl: string;
  email?: string;
  workspaceId?: string;
  workspaceName?: string;
  // Active stagenet per workspace id (set via `contract.dev stagenet use`), so
  // switching workspaces can never silently target another workspace's fork.
  activeStagenets?: Record<string, { id: string; name: string }>;
}

// $HOME first (the conventional CLI override; also what tests point at a tmp dir —
// os.homedir() alone reads the C-level environ, which sandboxed test envs don't touch),
// falling back to os.homedir() where HOME is unset (e.g. Windows).
function homeDir(): string {
  return process.env.HOME || homedir();
}

export function credentialsPath(): string {
  return join(homeDir(), '.contract.dev', 'credentials.json');
}

export function loadCredentials(): StoredCredentials | null {
  try {
    const parsed = JSON.parse(readFileSync(credentialsPath(), 'utf8'));
    if (typeof parsed?.apiKey !== 'string' || !parsed.apiKey) return null;
    return {
      apiKey: parsed.apiKey,
      apiUrl: typeof parsed.apiUrl === 'string' && parsed.apiUrl ? parsed.apiUrl : DEFAULT_API_URL,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      workspaceId: typeof parsed.workspaceId === 'string' ? parsed.workspaceId : undefined,
      workspaceName: typeof parsed.workspaceName === 'string' ? parsed.workspaceName : undefined,
      activeStagenets:
        parsed.activeStagenets && typeof parsed.activeStagenets === 'object' ? parsed.activeStagenets : undefined,
    };
  } catch {
    // missing or corrupt file = logged out
    return null;
  }
}

export function saveCredentials(credentials: StoredCredentials): string {
  const path = credentialsPath();
  mkdirSync(join(homeDir(), '.contract.dev'), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600 });
  return path;
}

export function clearCredentials(): boolean {
  const path = credentialsPath();
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

export interface ResolvedAuth {
  apiKey: string;
  apiUrl: string;
  source: 'env' | 'file';
  // Active workspace (id or slug) sent with each request; server checks membership.
  workspace?: string;
}

// Env wins over the saved file so CI and one-off overrides behave predictably.
// CONTRACT_DEV_WORKSPACE (id or slug) overrides the saved active workspace.
export function resolveAuth(): ResolvedAuth | null {
  const envWorkspace = process.env.CONTRACT_DEV_WORKSPACE || undefined;
  const envKey = process.env.CONTRACT_DEV_API_KEY;
  if (envKey) {
    return {
      apiKey: envKey,
      apiUrl: process.env.CONTRACT_DEV_API_URL || DEFAULT_API_URL,
      source: 'env',
      workspace: envWorkspace,
    };
  }
  const stored = loadCredentials();
  if (!stored) return null;
  return {
    apiKey: stored.apiKey,
    apiUrl: process.env.CONTRACT_DEV_API_URL || stored.apiUrl,
    source: 'file',
    workspace: envWorkspace ?? stored.workspaceId,
  };
}

export function requireAuth(): ResolvedAuth {
  const auth = resolveAuth();
  if (!auth) {
    throw new Error('Not logged in. Run `contract.dev login`.');
  }
  return auth;
}

// Authenticated call against the contract.dev app API.
export async function apiRequest<T>(
  auth: ResolvedAuth,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${auth.apiUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.apiKey}`,
      ...(auth.workspace ? { 'X-Contract-Dev-Workspace': auth.workspace } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload: any = await response.json().catch(() => null);
  if (response.status === 401) {
    throw new Error('API key was rejected. Run `contract.dev login` again.');
  }
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }
  return payload as T;
}
