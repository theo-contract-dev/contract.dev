import path from 'path';
import fs from 'fs';
import os from 'os';

import {
    createStagenetTestEnv,
    StagenetTestEnv,
    cleanUpStagenetTestEnv,
} from '../../../client/test/utils/test-environment';

import { generateWalletCommand } from '../../src/cli/commands/generate-wallet';

jest.setTimeout(600000);

const CLIENT_DIR = path.resolve(__dirname, '../../../client');
const ORIGINAL_CWD = process.cwd();
const EXPECTED_FUND_WEI = '1000000000000000000000000';

describe('contract.dev generate-wallet', () => {
    let env: StagenetTestEnv;
    let tmpDir: string;

    beforeAll(async () => {
        process.chdir(CLIENT_DIR);
        env = await createStagenetTestEnv({ instantMode: true });
        process.chdir(ORIGINAL_CWD);

        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-dev-wallet-'));
        fs.writeFileSync(
            path.join(tmpDir, 'contract.dev.cjs'),
            `module.exports = { rpcUrl: ${JSON.stringify(env.stagenetUrl)} };\n`,
        );
    }, 180000);

    afterAll(async () => {
        process.chdir(ORIGINAL_CWD);
        if (env) await cleanUpStagenetTestEnv(env);
        if (tmpDir && fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    }, 120000);

    it('generates a wallet and funds it with 1,000,000 native tokens', async () => {
        process.chdir(tmpDir);
        const wallet = await generateWalletCommand();

        expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);

        const balance = await env.stagenetProvider.getBalance(wallet.address);
        expect(balance.toString()).toBe(EXPECTED_FUND_WEI);
    });

    it('generates a fresh wallet on each call (no reuse)', async () => {
        process.chdir(tmpDir);
        const a = await generateWalletCommand();
        const b = await generateWalletCommand();

        expect(a.address).not.toBe(b.address);
        expect(a.privateKey).not.toBe(b.privateKey);

        // Both should be funded on-chain.
        const balanceA = await env.stagenetProvider.getBalance(a.address);
        const balanceB = await env.stagenetProvider.getBalance(b.address);
        expect(balanceA.toString()).toBe(EXPECTED_FUND_WEI);
        expect(balanceB.toString()).toBe(EXPECTED_FUND_WEI);
    });
});
