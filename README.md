# contract.dev

Command-line tool for working with a [contract.dev](https://contract.dev) Stagenet.

Push your Hardhat or Foundry contracts to a Stagenet, then mint balances, impersonate accounts, and override state — right from your terminal. Each pushed contract gets a Workspace: a custom dashboard with transactions, balances, storage, and tracked data.

## Install

```bash
npm install contract.dev
```

## Setup

```bash
contract.dev login                   # device-code sign-in, opens the browser
contract.dev stagenets               # list the active workspace's stagenets
contract.dev stagenet use avax-fork  # pick the one to target (stored per workspace)
```

No config files. The CLI keeps an account-level API key plus your active
workspace and stagenet in `~/.contract.dev/credentials.json`. One-off overrides
on any stagenet command: `--stagenet <name>`, or `--rpc-url <url>` for a direct
URL that needs no login at all. CI sets `CONTRACT_DEV_API_KEY` /
`CONTRACT_DEV_WORKSPACE` / `CONTRACT_DEV_STAGENET` (or `CONTRACT_DEV_RPC_URL`).

## Push contracts

From your Foundry/Hardhat project root, after `forge build` or `npx hardhat compile`:

```bash
contract.dev push-contracts
```

Each contract becomes a pending Workspace, matched to deployments by bytecode.
Re-run after each rebuild — unchanged contracts are no-ops. Source/artifact dirs
are auto-detected; pass `--contracts <dir>` / `--artifacts <dir>` when your
hardhat.config computes paths dynamically.

## Watch mainnet accounts

Sign in once per machine, then manage your workspace's mainnet watchlist (the
accounts shown on the contract.dev home map and /accounts) from the terminal:

```bash
contract.dev login                          # device-code sign-in, opens the browser
contract.dev workspace use my-team          # switch the workspace the CLI acts on
contract.dev watch 0xA0b8... --chain 1      # watch a contract (or wallet — auto-detected)
contract.dev watch 0xdead... --chains 1,8453  # watch a wallet on explicit chains
contract.dev watch list
contract.dev unwatch 0xA0b8... --chain 1
```

`login` saves an account-level API key to `~/.contract.dev/credentials.json`;
the active workspace is a local setting (`contract.dev workspace`). In CI, skip
login and set `CONTRACT_DEV_API_KEY` (plus `CONTRACT_DEV_WORKSPACE`) instead.

## Commands

```
contract.dev login                Connect the CLI to your contract.dev account
contract.dev whoami               Show the signed-in account + workspace
contract.dev workspace            Show/switch the active workspace
contract.dev stagenets            List the workspace's stagenets
contract.dev stagenet use         Set the active stagenet
contract.dev logout               Delete the saved credentials
contract.dev push-contracts       Push compiled artifacts
contract.dev generate-wallet      Generate + fund a wallet
contract.dev watch                Watch mainnet contracts + wallets
contract.dev unwatch              Archive a watched account
contract.dev balance              Change native balances
contract.dev erc20-balance        Change ERC20 balances
contract.dev state                Override code / nonce / storage
contract.dev impersonate          Impersonate an address
contract.dev follow               Pin contract state to live mainnet
contract.dev unfollow             Stop following
contract.dev function-override    Override contract function results
```

Run `contract.dev <command> help` for per-command flags.

## Docs

Full reference: [docs.contract.dev](https://docs.contract.dev/sdk-and-cli).
