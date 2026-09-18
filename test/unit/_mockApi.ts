// Fetch mock shared by the app-API command tests: records every call (method, path, auth
// header, parsed body) and answers from a `METHOD /path` handler table. A call with no
// handler throws, so a test can't pass on a request it didn't expect.
export const API_URL = 'https://test.contract.dev';

export interface RecordedCall {
    method: string;
    path: string;
    auth?: string;
    workspace?: string;
    body: any;
}

type Handler = (call: RecordedCall) => { status?: number; payload: unknown };

export function mockApi(handlers: Record<string, Handler>): RecordedCall[] {
    const calls: RecordedCall[] = [];
    global.fetch = jest.fn(async (url: any, init: any) => {
        const u = String(url);
        const method = init?.method ?? 'GET';
        const call: RecordedCall = {
            method,
            path: u.slice(API_URL.length),
            auth: init?.headers?.Authorization,
            workspace: init?.headers?.['X-Contract-Dev-Workspace'],
            body: init?.body ? JSON.parse(init.body) : null,
        };
        calls.push(call);
        // Handlers are keyed without the query string; the recorded path keeps it.
        const key = `${method} ${call.path.split('?')[0]}`;
        const handler = handlers[key];
        if (!handler) throw new Error(`Unexpected fetch: ${key}`);
        const { status = 200, payload } = handler(call);
        return { ok: status < 400, status, json: async () => payload } as any;
    }) as any;
    return calls;
}

// Env-key auth for every test in a file; restores fetch + env afterwards.
export function useEnvAuth(): void {
    const realFetch = global.fetch;
    beforeEach(() => {
        process.env.CONTRACT_DEV_API_KEY = 'env-key';
        process.env.CONTRACT_DEV_API_URL = API_URL;
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
        global.fetch = realFetch;
        delete process.env.CONTRACT_DEV_API_KEY;
        delete process.env.CONTRACT_DEV_API_URL;
        jest.restoreAllMocks();
    });
}

export const printed = (): string[] =>
    (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c.join(' '));
