import { watchCommand, unwatchCommand } from '../../src/cli/commands/watch';

const API_URL = 'https://test.contract.dev';

function mockApi(handlers: Record<string, (init: any) => { status?: number; payload: unknown }>) {
    const calls: Array<{ method: string; url: string; auth?: string; body: any }> = [];
    global.fetch = jest.fn(async (url: any, init: any) => {
        const u = String(url);
        const method = init?.method ?? 'GET';
        calls.push({
            method,
            url: u,
            auth: init?.headers?.Authorization,
            body: init?.body ? JSON.parse(init.body) : null,
        });
        const key = `${method} ${u.slice(API_URL.length)}`;
        const handler = handlers[key];
        if (!handler) throw new Error(`Unexpected fetch: ${key}`);
        const { status = 200, payload } = handler(init);
        return { ok: status < 400, status, json: async () => payload } as any;
    }) as any;
    return calls;
}

describe('watch / unwatch (mainnet watchlist)', () => {
    const realFetch = global.fetch;

    beforeEach(() => {
        process.env.CONTRACT_DEV_API_KEY = 'env-key';
        process.env.CONTRACT_DEV_API_URL = API_URL;
    });

    afterEach(() => {
        global.fetch = realFetch;
        delete process.env.CONTRACT_DEV_API_KEY;
        delete process.env.CONTRACT_DEV_API_URL;
    });

    it('watch posts the address with bearer auth and prints the result', async () => {
        const calls = mockApi({
            'POST /api/mainnet/accounts': () => ({
                status: 201,
                payload: {
                    created: true,
                    account: {
                        id: 'wc1',
                        chainId: 8453,
                        chainIds: [8453],
                        address: '0xabc',
                        accountType: 'contract',
                        name: 'Treasury',
                    },
                },
            }),
        });

        await watchCommand(['0xAbC', '--chain', '8453', '--name', 'Treasury']);

        expect(calls[0].auth).toBe('Bearer env-key');
        expect(calls[0].body).toEqual({ chainId: 8453, address: '0xAbC', name: 'Treasury' });
    });

    it('watch --chains passes explicit wallet chain membership', async () => {
        const calls = mockApi({
            'POST /api/mainnet/accounts': () => ({
                status: 201,
                payload: {
                    created: true,
                    account: { id: 'ww1', chainId: 1, chainIds: [1, 8453], address: '0xdef', accountType: 'wallet', name: null },
                },
            }),
        });

        await watchCommand(['0xDeF', '--chains', '1,8453']);
        expect(calls[0].body).toEqual({ chainId: 1, address: '0xDeF', chainIds: [1, 8453] });
    });

    it('unwatch resolves the id from the list and archives it', async () => {
        const accounts = [
            { id: 'a1', chainId: 1, chainIds: [1], address: '0xaaa', accountType: 'contract', name: 'Old' },
            { id: 'a2', chainId: 8453, chainIds: [8453], address: '0xaaa', accountType: 'contract', name: 'New' },
        ];
        const calls = mockApi({
            'GET /api/mainnet/accounts': () => ({ payload: { accounts } }),
            'DELETE /api/mainnet/accounts/a2': () => ({ payload: { ok: true } }),
        });

        await unwatchCommand(['0xAAA', '--chain', '8453']);
        expect(calls.map((c) => `${c.method} ${c.url.slice(API_URL.length)}`)).toEqual([
            'GET /api/mainnet/accounts',
            'DELETE /api/mainnet/accounts/a2',
        ]);
    });

    it('unwatch demands --chain when multiple entries match', async () => {
        const accounts = [
            { id: 'a1', chainId: 1, chainIds: [1], address: '0xaaa', accountType: 'contract', name: null },
            { id: 'a2', chainId: 8453, chainIds: [8453], address: '0xaaa', accountType: 'contract', name: null },
        ];
        mockApi({ 'GET /api/mainnet/accounts': () => ({ payload: { accounts } }) });

        await expect(unwatchCommand(['0xAAA'])).rejects.toThrow(/--chain/);
    });

    it('fails with a login hint when no credential is available', async () => {
        const originalHome = process.env.HOME;
        delete process.env.CONTRACT_DEV_API_KEY;
        process.env.HOME = '/nonexistent-home-for-test';
        try {
            await expect(watchCommand(['0xAbC'])).rejects.toThrow(/contract\.dev login/);
        } finally {
            process.env.HOME = originalHome;
        }
    });
});
