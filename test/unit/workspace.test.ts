import fs from 'fs';
import os from 'os';
import path from 'path';

import { workspaceCommand } from '../../src/cli/commands/workspace';
import { watchCommand } from '../../src/cli/commands/watch';

const API_URL = 'https://test.contract.dev';

const WHOAMI = {
    email: 'theo@contract.dev',
    org: { id: 'o1', name: 'Personal', slug: 'personal' },
    workspaces: [
        { id: 'o1', name: 'Personal', slug: 'personal' },
        { id: 'o2', name: 'DZap', slug: 'dzap' },
    ],
};

describe('workspace switching', () => {
    const realFetch = global.fetch;
    const originalHome = process.env.HOME;
    let tmpHome: string;

    beforeEach(() => {
        tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-dev-ws-'));
        process.env.HOME = tmpHome;
        delete process.env.CONTRACT_DEV_API_KEY;
        delete process.env.CONTRACT_DEV_API_URL;
        delete process.env.CONTRACT_DEV_WORKSPACE;
        fs.mkdirSync(path.join(tmpHome, '.contract.dev'), { recursive: true });
        fs.writeFileSync(
            path.join(tmpHome, '.contract.dev', 'credentials.json'),
            JSON.stringify({ apiKey: 'file-key', apiUrl: API_URL }),
        );
    });

    afterEach(() => {
        global.fetch = realFetch;
        process.env.HOME = originalHome;
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it('use switches the active workspace; later calls carry the header', async () => {
        let accountsHeaders: any = null;
        global.fetch = jest.fn(async (url: any, init: any) => {
            const u = String(url);
            if (u.endsWith('/api/cli/whoami')) return { ok: true, status: 200, json: async () => WHOAMI } as any;
            if (u.endsWith('/api/mainnet/accounts')) {
                accountsHeaders = init?.headers;
                return { ok: true, status: 200, json: async () => ({ accounts: [] }) } as any;
            }
            throw new Error(`Unexpected fetch: ${u}`);
        }) as any;

        await workspaceCommand(['use', 'dzap']);

        const creds = JSON.parse(fs.readFileSync(path.join(tmpHome, '.contract.dev', 'credentials.json'), 'utf8'));
        expect(creds.workspaceId).toBe('o2');
        expect(creds.workspaceName).toBe('DZap');

        await watchCommand(['list']);
        expect(accountsHeaders['X-Contract-Dev-Workspace']).toBe('o2');
    });

    it('rejects a workspace the account does not belong to', async () => {
        global.fetch = jest.fn(async (url: any) => {
            if (String(url).endsWith('/api/cli/whoami')) return { ok: true, status: 200, json: async () => WHOAMI } as any;
            throw new Error('Unexpected fetch');
        }) as any;

        await expect(workspaceCommand(['use', 'not-mine'])).rejects.toThrow(/No workspace matches "not-mine"/);
    });

    it('CONTRACT_DEV_WORKSPACE env overrides the saved active workspace', async () => {
        process.env.CONTRACT_DEV_WORKSPACE = 'dzap';
        let accountsHeaders: any = null;
        global.fetch = jest.fn(async (url: any, init: any) => {
            const u = String(url);
            if (u.endsWith('/api/mainnet/accounts')) {
                accountsHeaders = init?.headers;
                return { ok: true, status: 200, json: async () => ({ accounts: [] }) } as any;
            }
            throw new Error(`Unexpected fetch: ${u}`);
        }) as any;

        await watchCommand(['list']);
        expect(accountsHeaders['X-Contract-Dev-Workspace']).toBe('dzap');
    });
});
