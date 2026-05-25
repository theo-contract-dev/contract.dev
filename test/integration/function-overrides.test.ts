import { ethers } from 'ethers';

import {
    createStagenetTestEnv,
    StagenetTestEnv,
    cleanUpStagenetTestEnv,
} from '../../../client/test/utils/test-environment';
import { compileContract } from '../../../client/test/utils/compiler';

import { createStagenet, Stagenet } from '../../src/index';

jest.setTimeout(600000);

describe('contract.dev function-override SDK methods', () => {
    let env: StagenetTestEnv;
    let stagenet: Stagenet;
    let contractAddress: string;
    let contract: ethers.Contract;

    beforeAll(async () => {
        env = await createStagenetTestEnv({ instantMode: true });
        stagenet = createStagenet(env.stagenetUrl);

        const { abi, bytecode } = await compileContract('FunctionOverrideTester.sol');
        const factory = new ethers.ContractFactory(abi, bytecode, env.testWallet);
        const deployed = await factory.deploy();
        await deployed.waitForDeployment();
        contractAddress = await deployed.getAddress();
        contract = new ethers.Contract(contractAddress, abi, env.stagenetProvider);
    }, 180000);

    afterAll(async () => {
        if (env) await cleanUpStagenetTestEnv(env);
    }, 120000);

    const getCountAbi = JSON.stringify({
        type: 'function',
        name: 'getCount',
        inputs: [],
        outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'view',
    });

    it('addFunctionOverride → contract returns the override', async () => {
        const override = await stagenet.addFunctionOverride({
            contractAddress,
            functionAbi: getCountAbi,
            returnValues: ['42'],
        });
        expect(override.enabled).toBe(true);
        expect(override.returnValues).toEqual(['42']);

        expect(Number(await contract.getCount())).toBe(42);

        await stagenet.removeFunctionOverride(override.id);
        expect(Number(await contract.getCount())).toBe(0);
    });

    it('update → disable → enable → remove lifecycle', async () => {
        const override = await stagenet.addFunctionOverride({
            contractAddress,
            functionAbi: getCountAbi,
            returnValues: ['1'],
        });
        expect(Number(await contract.getCount())).toBe(1);

        await stagenet.updateFunctionOverride(override.id, ['2']);
        expect(Number(await contract.getCount())).toBe(2);

        const disabled = await stagenet.disableFunctionOverride(override.id);
        expect(disabled.enabled).toBe(false);
        expect(Number(await contract.getCount())).toBe(0);

        const enabled = await stagenet.enableFunctionOverride(override.id);
        expect(enabled.enabled).toBe(true);
        expect(Number(await contract.getCount())).toBe(2);

        const removed = await stagenet.removeFunctionOverride(override.id);
        expect(removed.removed).toBe(true);
    });

    it('listing — getFunctionOverrides and getFunctionOverridesByContract', async () => {
        const o = await stagenet.addFunctionOverride({
            contractAddress,
            functionAbi: getCountAbi,
            returnValues: ['9'],
        });

        const all = await stagenet.getFunctionOverrides();
        expect(all.find((x) => x.id === o.id)).toBeDefined();

        const byContract = await stagenet.getFunctionOverridesByContract(contractAddress);
        expect(byContract.find((x) => x.id === o.id)).toBeDefined();

        await stagenet.removeFunctionOverride(o.id);
    });
});
