import fs from 'fs';
import os from 'os';
import path from 'path';

import { createStagenet } from '../../src/index';
import { stateCommand } from '../../src/cli/commands/state';

const ORIGINAL_CWD = process.cwd();
const RPC_URL = 'https://rpc.contract.dev/test-key';

const SLOT_7 = '0x' + '7'.padStart(64, '0');
const VALUE = '0x' + 'ab'.padStart(64, '0');

// Capture JSON-RPC requests; respond with a canned result per method.
function mockFetch(results: Record<string, unknown>) {
    const calls: Array<{ method: string; params: unknown[] }> = [];
    global.fetch = jest.fn(async (_url: any, init: any) => {
        const body = JSON.parse(init.body);
        calls.push({ method: body.method, params: body.params });
        return {
            ok: true,
            json: async () => ({ jsonrpc: '2.0', id: body.id, result: results[body.method] ?? {} }),
        } as any;
    }) as any;
    return calls;
}

describe('state set-storage slot keys', () => {
    const realFetch = global.fetch;
    afterEach(() => {
        global.fetch = realFetch;
        process.chdir(ORIGINAL_CWD);
    });

    describe('SDK', () => {
        it('setStorageAt normalizes decimal slot numbers; values pass through', async () => {
            const calls = mockFetch({ dev_setStorageAt: { address: '0xc', slot: SLOT_7 } });
            const stagenet = createStagenet(RPC_URL);

            await stagenet.setStorageAt('0xContract', 7, VALUE);
            await stagenet.setStorageAt('0xContract', '7', VALUE);
            await stagenet.setStorageAt('0xContract', BigInt(7), VALUE);
            await stagenet.setStorageAt('0xContract', SLOT_7, VALUE);

            for (const call of calls) {
                expect(call.params).toEqual(['0xContract', SLOT_7, VALUE]);
            }
        });
    });

    describe('CLI', () => {
        let tmpDir: string;

        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-dev-state-'));
            fs.writeFileSync(
                path.join(tmpDir, 'contract.dev.js'),
                `module.exports = { rpcUrl: ${JSON.stringify(RPC_URL)} };`,
            );
            process.chdir(tmpDir);
        });

        afterEach(() => {
            process.chdir(ORIGINAL_CWD);
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it('--slot accepts decimal and short hex, normalized to the 32-byte key', async () => {
            const calls = mockFetch({ dev_setStorageAt: { address: '0xc', slot: SLOT_7 } });

            await stateCommand(['set-storage', '0xContract', '--slot', '7', '--value', VALUE]);
            await stateCommand(['set-storage', '0xContract', '--slot', '0x7', '--value', VALUE]);
            await stateCommand(['set-storage', '0xContract', '--slot', SLOT_7, '--value', VALUE]);

            for (const call of calls) {
                expect(call).toEqual({ method: 'dev_setStorageAt', params: ['0xContract', SLOT_7, VALUE] });
            }
        });

        it('keeps the strict 32-byte rule for --value', async () => {
            mockFetch({});
            await expect(
                stateCommand(['set-storage', '0xContract', '--slot', '7', '--value', '0xab']),
            ).rejects.toThrow(/--value must be a 32-byte hex word/);
        });

        it('rejects malformed --slot', async () => {
            mockFetch({});
            await expect(
                stateCommand(['set-storage', '0xContract', '--slot', 'banana', '--value', VALUE]),
            ).rejects.toThrow(/--slot must be/);
        });
    });
});
