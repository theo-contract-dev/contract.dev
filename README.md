# contract.dev

A TypeScript SDK and CLI for working with a [contract.dev](https://contract.dev) Stagenet.

Use it to:

1. Upload contract artifacts from your Hardhat or Foundry project to your Stagenet.
2. Interact with your Stagenet from scripts by:
   - Minting native tokens or ERC20s
   - Impersonating accounts
   - Overriding Stagenet state

When you deploy a previously uploaded contract to your Stagenet, a Workspace is created for it automatically.

A Workspace is a custom dashboard for a contract. It shows transactions, balances, TVL, storage, and tracked data over time.

## Install

```bash
npm install contract.dev
```

## Setup

Create a `contract.dev.js` file in your project root:

```bash
contract.dev init
```

Add your Stagenet RPC URL:

```js
/** @type {import('contract.dev').Config} */
module.exports = {
  // Use the RPC URL from your Stagenet dashboard
  rpcUrl: "<YOUR_STAGENET_RPC_URL>"
};
```

Use `contract.dev.cjs` instead if your `package.json` has `"type": "module"`.

## Upload contracts

Use the CLI to upload contract artifacts from a Hardhat or Foundry project.
Uploaded contracts are matched against deployments on your Stagenet.
When a matching contract is deployed, a Workspace is created for it automatically.

With a `contract.dev.js` at your project root:

```bash
contract.dev upload-contracts
```

The CLI reads compiled build artifacts.
It does not build your project automatically, so run `forge build` or `npx hardhat compile` first.

## Interact with Stagenet

```ts
import { createStagenet } from "contract.dev";

const stagenet = createStagenet("<YOUR_STAGENET_RPC_URL>");
```

Or call `createStagenet()` with no arguments to use the URL in `contract.dev.js`:

```ts
const stagenet = createStagenet();
```

### Balances

Change token balances.

```ts
await stagenet.addBalance(addr, 10n ** 18n);            // +1 ETH (additive)
await stagenet.setBalance(addr, 0n);                    // overwrite

await stagenet.addERC20Balance(addr, usdc, 1_000_000n); // +1 USDC
await stagenet.setERC20Balance(addr, usdc, 0n);         // overwrite
```

### State overrides

Override the on-chain state of your Stagenet.

```ts
await stagenet.setCode(addr, "0x6042...");

await stagenet.setNonce(addr, 42);

// Slot and value must be exactly 32-byte hex words (0x + 64 hex chars)
const pad = (n: bigint) => "0x" + n.toString(16).padStart(64, "0");
await stagenet.setStorageAt(addr, pad(0n), pad(42n));
```

### Impersonation

Send Stagenet transactions from an address without holding its private key.

```ts
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("<YOUR_STAGENET_RPC_URL>");

const whale = "0x28C6c06298d514Db089934071355E5743bf21d60";
const recipient = "0x1111111111111111111111111111111111111111";
const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const erc20 = new ethers.Contract(
  usdc,
  [
    "function transfer(address to, uint256 amount) returns (bool)"
  ],
  provider
);

// Start impersonating the address
await stagenet.impersonateAccount(whale);

// Get a JSON-RPC signer for the impersonated address
const signer = await provider.getSigner(whale);

// Send the transaction as the impersonated address
await erc20.connect(signer).transfer(recipient, 1_000_000n);

// Stop impersonating when finished
await stagenet.stopImpersonatingAccount(whale);
```

Impersonation only works with transactions sent through `eth_sendTransaction`.
If your wallet signs locally with a private key, it will use `eth_sendRawTransaction`, and impersonation will not apply.

Use a JSON-RPC signer instead, such as `provider.getSigner(address)` in ethers.

## Docs

Full reference is available at [docs.contract.dev/sdk](https://docs.contract.dev/sdk).
