import fs from 'fs';
import os from 'os';
import path from 'path';

import { initCommand } from '../../src/cli/commands/init';

const ORIGINAL_CWD = process.cwd();

describe('init', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-dev-init-'));
    });

    afterEach(() => {
        process.chdir(ORIGINAL_CWD);
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writes contract.dev.cjs when nearest package.json declares type:module', async () => {
        fs.writeFileSync(
            path.join(tmpDir, 'package.json'),
            JSON.stringify({ name: 'esm-fixture', type: 'module' }),
        );
        process.chdir(tmpDir);

        await initCommand(['--rpc-url=https://example.test/rpc']);

        expect(fs.existsSync(path.join(tmpDir, 'contract.dev.cjs'))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, 'contract.dev.js'))).toBe(false);
    });

    it('writes contract.dev.js when package.json has no type:module', async () => {
        fs.writeFileSync(
            path.join(tmpDir, 'package.json'),
            JSON.stringify({ name: 'cjs-fixture' }),
        );
        process.chdir(tmpDir);

        await initCommand(['--rpc-url=https://example.test/rpc']);

        expect(fs.existsSync(path.join(tmpDir, 'contract.dev.js'))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, 'contract.dev.cjs'))).toBe(false);
    });

    it('writes contract.dev.js when no package.json exists at all', async () => {
        process.chdir(tmpDir);

        await initCommand(['--rpc-url=https://example.test/rpc']);

        expect(fs.existsSync(path.join(tmpDir, 'contract.dev.js'))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, 'contract.dev.cjs'))).toBe(false);
    });
});
