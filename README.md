# contract.dev

TypeScript SDK and CLI for working with a [contract.dev](https://contract.dev) Stagenet.

Push your Hardhat or Foundry contracts to a Stagenet, then mint balances, impersonate accounts, override state, and track on-chain values over time — from scripts or the CLI. Each pushed contract gets a Workspace: a custom dashboard with transactions, balances, storage, and tracked data.

## Install

```bash
npm install contract.dev
```

## Setup

```bash
contract.dev init
```

Then add your Stagenet RPC URL to `contract.dev.js`:

```js
/** @type {import('contract.dev').Config} */
module.exports = {
  rpcUrl: "<YOUR_STAGENET_RPC_URL>"
};
```

Use `contract.dev.cjs` if your `package.json` has `"type": "module"`.

## Push contracts

After `forge build` or `npx hardhat compile`:

```bash
contract.dev push-contracts
```

Each contract becomes a pending Workspace, matched to deployments by bytecode. Re-run after each rebuild — unchanged contracts are no-ops.

## Use the SDK

```ts
import { createStagenet } from "contract.dev";

// Loads rpcUrl from contract.dev.js, or pass one explicitly
const stagenet = createStagenet();

await stagenet.addBalance(addr, 10n ** 18n);            // +1 ETH
await stagenet.addERC20Balance(addr, usdc, 1_000_000n); // +1 USDC
await stagenet.impersonateAccount(whale);
await stagenet.setStorageAt(addr, slot, value);
```

## CLI

```
contract.dev init                 Create contract.dev.js
contract.dev push-contracts       Push compiled artifacts
contract.dev generate-wallet      Generate + fund a wallet
contract.dev workspace add        Attach a Workspace to an address
contract.dev balance              Change native balances
contract.dev erc20-balance        Change ERC20 balances
contract.dev state                Override code / nonce / storage
contract.dev impersonate          Impersonate an address
contract.dev function-override    Override contract function results
contract.dev track                Record on-chain state over time
```

Run `contract.dev <command> help` for per-command flags.

## Docs

Full reference: [docs.contract.dev](https://docs.contract.dev/sdk-and-cli).
