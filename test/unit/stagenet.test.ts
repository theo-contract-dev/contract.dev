import fs from 'fs';
import os from 'os';
import path from 'path';

import { stagenetCommand } from '../../src/cli/commands/stagenet';
import { followCommand } from '../../src/cli/commands/follow';
import { extractTargetFlags, resetTargetOverrides } from '../../src/cli/target';

const API_URL = 'https://test.contract.dev';

const STAGENETS = {
    workspace: { id: 'o1', name: 'Personal', slug: 'personal' },
    stagenets: [
        { id: 's1', name: 'avax-fork', chainId: 777001, forkChainId: 43114, rpcUrl: 'https://rpc.local/key-s1' },
        { id: 's2', name: 'base-fork', chainId: 777002, forkChainId: 8453, rpcUrl: 'https://rpc.local/key-s2' },
    ],
};

// Answers the stagenets API and any stagenet JSON-RPC; records everything.
function mockFetch() {
    const calls: Array<{ url: string; method: string; body: any }> = [];
    global.fetch = jest.fn(async (url: any, init: any) => {
        const u = String(url);
        calls.push({ url: u, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : null });
        if (u === `${API_URL}/api/cli/stagenets`) {
            return { ok: true, status: 200, json: async () => STAGENETS } as any;
        }
        if (u.startsWith('https://rpc.local/')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ jsonrpc: '2.0', id: 1, result: { accounts: [], slots: {} } }),
            } as any;
        }
        throw new Error(`Unexpected fetch: ${u}`);
    }) as any;
    return calls;
}

describe('stagenet targeting', () => {
    const realFetch = global.fetch;
    const originalHome = process.env.HOME;
    let tmpHome: string;

    beforeEach(() => {
        tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-dev-target-'));
        process.env.HOME = tmpHome;
        delete process.env.CONTRACT_DEV_API_KEY;
        delete process.env.CONTRACT_DEV_API_URL;
        delete process.env.CONTRACT_DEV_WORKSPACE;
        delete process.env.CONTRACT_DEV_STAGENET;
        delete process.env.CONTRACT_DEV_RPC_URL;
        fs.mkdirSync(path.join(tmpHome, '.contract.dev'), { recursive: true });
        fs.writeFileSync(
            path.join(tmpHome, '.contract.dev', 'credentials.json'),
            JSON.stringify({ apiKey: 'file-key', apiUrl: API_URL }),
        );
    });

    afterEach(() => {
        global.fetch = realFetch;
        process.env.HOME = originalHome;
        resetTargetOverrides();
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it('stagenet use pins per workspace; stagenet commands resolve through it', async () => {
        const calls = mockFetch();
        await stagenetCommand(['use', 'avax-fork']);

        const creds = JSON.parse(fs.readFileSync(path.join(tmpHome, '.contract.dev', 'credentials.json'), 'utf8'));
        expect(creds.activeStagenets).toEqual({ o1: { id: 's1', name: 'avax-fork' } });

        await followCommand(['list']);
        const rpcCalls = calls.filter((c) => c.url.startsWith('https://rpc.local/'));
        expect(rpcCalls).toHaveLength(1);
        expect(rpcCalls[0].url).toBe('https://rpc.local/key-s1');
        expect(rpcCalls[0].body.method).toBe('dev_getFollowed');
    });

    it('--stagenet overrides the pinned one for a single invocation', async () => {
        const calls = mockFetch();
        const rest = extractTargetFlags(['follow', 'list', '--stagenet', 'base-fork']);
        expect(rest).toEqual(['follow', 'list']);

        await followCommand(['list']);
        const rpcCalls = calls.filter((c) => c.url.startsWith('https://rpc.local/'));
        expect(rpcCalls[0].url).toBe('https://rpc.local/key-s2');
    });

    it('--rpc-url skips the API entirely (no login needed)', async () => {
        const calls = mockFetch();
        extractTargetFlags(['--rpc-url=https://rpc.local/direct']);

        await followCommand(['list']);
        expect(calls.some((c) => c.url.endsWith('/api/cli/stagenets'))).toBe(false);
        expect(calls[0].url).toBe('https://rpc.local/direct');
    });

    it('errors with a hint when nothing is selected', async () => {
        mockFetch();
        await expect(followCommand(['list'])).rejects.toThrow(/stagenet use/);
    });

    it('rejects an unknown --stagenet with the available names', async () => {
        mockFetch();
        extractTargetFlags(['--stagenet', 'nope']);
        await expect(followCommand(['list'])).rejects.toThrow(/avax-fork, base-fork/);
    });
});
