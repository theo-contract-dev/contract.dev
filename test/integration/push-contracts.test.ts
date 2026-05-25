import path from 'path';
import fs from 'fs';
import os from 'os';

import {
    createStagenetTestEnv,
    StagenetTestEnv,
    cleanUpStagenetTestEnv,
} from '../../../client/test/utils/test-environment';
import {
    runCommand,
    ensureNpmDeps,
    ensureForgeLibs,
} from '../../../client/test/frameworks/utils';

import { pushContractsCommand } from '../../src/cli/commands/push-contracts';

jest.setTimeout(600000);

const FIXTURES_ROOT = path.resolve(__dirname, '../../../client/test/frameworks/projects');
const CLIENT_DIR = path.resolve(__dirname, '../../../client');
const HH_V3_NODE_VERSION = '22';

const ORIGINAL_CWD = process.cwd();

const NODE_22_DIR = path.join(
    require('os').homedir(),
    '.nvm/versions/node',
);
const NODE_22_AVAILABLE = fs.existsSync(NODE_22_DIR) &&
    fs.readdirSync(NODE_22_DIR).some((v) => v.startsWith(`v${HH_V3_NODE_VERSION}.`));
const hhV3Describe = NODE_22_AVAILABLE ? describe : describe.skip;
if (!NODE_22_AVAILABLE) {
    console.warn(
        `[push-contracts] skipping Hardhat v3 case: Node ${HH_V3_NODE_VERSION} not found under ~/.nvm/versions/node. Run \`nvm install ${HH_V3_NODE_VERSION}\` to enable.`,
    );
}

function writeStagenetConfig(projectDir: string, stagenetUrl: string): string {
    const configPath = path.join(projectDir, 'contract.dev.cjs');
    fs.writeFileSync(
        configPath,
        `module.exports = { rpcUrl: ${JSON.stringify(stagenetUrl)} };\n`,
    );
    return configPath;
}

function cleanFoundryArtifacts(projectDir: string) {
    for (const dir of ['out', 'cache']) {
        const p = path.join(projectDir, dir);
        if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    }
}

function cleanHardhatArtifacts(projectDir: string) {
    for (const dir of ['artifacts', 'cache', 'typechain-types']) {
        const p = path.join(projectDir, dir);
        if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    }
}

describe('contract.dev push-contracts', () => {
    describe('Foundry', () => {
        const projectDir = path.join(FIXTURES_ROOT, 'foundry');
        let env: StagenetTestEnv;
        let configPath: string;

        beforeAll(async () => {
            process.chdir(CLIENT_DIR);
            env = await createStagenetTestEnv({ instantMode: true });
            process.chdir(ORIGINAL_CWD);
            await ensureForgeLibs(projectDir);
            cleanFoundryArtifacts(projectDir);
            const build = await runCommand(projectDir, 'forge', ['build']);
            expect(build.exitCode).toBe(0);
            configPath = writeStagenetConfig(projectDir, env.stagenetUrl);
        }, 240000);

        afterAll(async () => {
            process.chdir(ORIGINAL_CWD);
            if (configPath && fs.existsSync(configPath)) fs.unlinkSync(configPath);
            await cleanUpStagenetTestEnv(env);
        }, 120000);

        it('uploads Counter and reports status=created on first run', async () => {
            process.chdir(projectDir);
            const result = await pushContractsCommand();

            expect(result.contracts.length).toBeGreaterThan(0);
            const counter = result.contracts.find((c) => c.name === 'Counter');
            expect(counter).toBeDefined();
            expect(counter!.status).toBe('created');
            expect(counter!.projectContractId).toMatch(/.+/);
            expect(counter!.projectContractVersionId).toMatch(/.+/);
        });

        it('reports status=unchanged when run again with the same artifacts', async () => {
            process.chdir(projectDir);
            const result = await pushContractsCommand();
            const counter = result.contracts.find((c) => c.name === 'Counter');
            expect(counter).toBeDefined();
            expect(counter!.status).toBe('unchanged');
        });
    });

    describe('Hardhat v2 (ethers)', () => {
        const projectDir = path.join(FIXTURES_ROOT, 'hardhat-v2-ethers');
        let env: StagenetTestEnv;
        let configPath: string;

        beforeAll(async () => {
            process.chdir(CLIENT_DIR);
            env = await createStagenetTestEnv({ instantMode: true });
            process.chdir(ORIGINAL_CWD);
            await ensureNpmDeps(projectDir);
            cleanHardhatArtifacts(projectDir);
            const build = await runCommand(projectDir, 'npx', ['hardhat', 'compile']);
            expect(build.exitCode).toBe(0);
            configPath = writeStagenetConfig(projectDir, env.stagenetUrl);
        }, 600000);

        afterAll(async () => {
            process.chdir(ORIGINAL_CWD);
            if (configPath && fs.existsSync(configPath)) fs.unlinkSync(configPath);
            await cleanUpStagenetTestEnv(env);
        }, 120000);

        it('uploads SimpleStorage and reports status=created on first run', async () => {
            process.chdir(projectDir);
            const result = await pushContractsCommand();

            const stored = result.contracts.find((c) => c.name === 'SimpleStorage');
            expect(stored).toBeDefined();
            expect(stored!.status).toBe('created');
            expect(stored!.projectContractId).toMatch(/.+/);
        });

        it('reports status=unchanged when run again', async () => {
            process.chdir(projectDir);
            const result = await pushContractsCommand();
            const stored = result.contracts.find((c) => c.name === 'SimpleStorage');
            expect(stored).toBeDefined();
            expect(stored!.status).toBe('unchanged');
        });
    });

    hhV3Describe('Hardhat v3 (ethers)', () => {
        const projectDir = path.join(FIXTURES_ROOT, 'hardhat-v3-ethers');
        let env: StagenetTestEnv;
        let configPath: string;

        beforeAll(async () => {
            process.chdir(CLIENT_DIR);
            env = await createStagenetTestEnv({ instantMode: true });
            process.chdir(ORIGINAL_CWD);
            await ensureNpmDeps(projectDir);
            cleanHardhatArtifacts(projectDir);
            const build = await runCommand(
                projectDir,
                'npx',
                ['hardhat', 'compile'],
                undefined,
                240000,
                { nodeVersion: HH_V3_NODE_VERSION },
            );
            expect(build.exitCode).toBe(0);
            configPath = writeStagenetConfig(projectDir, env.stagenetUrl);
        }, 600000);

        afterAll(async () => {
            process.chdir(ORIGINAL_CWD);
            if (configPath && fs.existsSync(configPath)) fs.unlinkSync(configPath);
            await cleanUpStagenetTestEnv(env);
        }, 120000);

        it('uploads Counter and reports status=created on first run', async () => {
            process.chdir(projectDir);
            const result = await pushContractsCommand();

            const counter = result.contracts.find((c) => c.name === 'Counter');
            expect(counter).toBeDefined();
            expect(counter!.status).toBe('created');
        });

        it('reports status=unchanged when run again', async () => {
            process.chdir(projectDir);
            const result = await pushContractsCommand();
            const counter = result.contracts.find((c) => c.name === 'Counter');
            expect(counter).toBeDefined();
            expect(counter!.status).toBe('unchanged');
        });
    });

    // Verifies the new artifacts-dir auto-detection: when a Hardhat project uses
    // `paths.sources = "src"`, artifacts land at `artifacts/src/` rather than the
    // hardcoded `artifacts/contracts/`. Builds in a temp dir that symlinks the
    // hh-v2-ethers fixture's node_modules to avoid a fresh `npm ci`.
    describe('Hardhat v2 with custom paths.sources = "src"', () => {
        const sourceFixture = path.join(FIXTURES_ROOT, 'hardhat-v2-ethers');
        let tmpDir: string;
        let env: StagenetTestEnv;
        let configPath: string;

        beforeAll(async () => {
            await ensureNpmDeps(sourceFixture);

            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-dev-custom-sources-'));
            fs.mkdirSync(path.join(tmpDir, 'src'));
            fs.copyFileSync(
                path.join(sourceFixture, 'contracts/SimpleStorage.sol'),
                path.join(tmpDir, 'src/SimpleStorage.sol'),
            );
            // Minimal hardhat config — no plugins needed; sourceDir override is the focus.
            fs.writeFileSync(
                path.join(tmpDir, 'hardhat.config.js'),
                `module.exports = { solidity: "0.8.28", paths: { sources: "src" } };\n`,
            );
            fs.writeFileSync(
                path.join(tmpDir, 'package.json'),
                JSON.stringify({ name: 'custom-sources-fixture', version: '0.0.0' }),
            );
            // Symlink node_modules from the hh-v2 fixture so `npx hardhat` and solc resolve.
            fs.symlinkSync(
                path.join(sourceFixture, 'node_modules'),
                path.join(tmpDir, 'node_modules'),
                'dir',
            );

            process.chdir(CLIENT_DIR);
            env = await createStagenetTestEnv({ instantMode: true });
            process.chdir(ORIGINAL_CWD);

            const build = await runCommand(tmpDir, 'npx', ['hardhat', 'compile']);
            expect(build.exitCode).toBe(0);

            // Sanity-check: HH wrote artifacts under `artifacts/src/`, not `artifacts/contracts/`.
            expect(fs.existsSync(path.join(tmpDir, 'artifacts/src/SimpleStorage.sol/SimpleStorage.json'))).toBe(true);
            expect(fs.existsSync(path.join(tmpDir, 'artifacts/contracts'))).toBe(false);

            configPath = writeStagenetConfig(tmpDir, env.stagenetUrl);
        }, 600000);

        afterAll(async () => {
            process.chdir(ORIGINAL_CWD);
            if (env) await cleanUpStagenetTestEnv(env);
            if (tmpDir && fs.existsSync(tmpDir)) {
                // unlink the symlink before rm so we don't recurse into the real node_modules
                const linkPath = path.join(tmpDir, 'node_modules');
                if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath);
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        }, 120000);

        it('finds SimpleStorage at artifacts/src and uploads it', async () => {
            process.chdir(tmpDir);
            const result = await pushContractsCommand();

            const stored = result.contracts.find((c) => c.name === 'SimpleStorage');
            expect(stored).toBeDefined();
            expect(stored!.status).toBe('created');
        });
    });
});
