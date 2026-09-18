# contract.dev

Command-line tool for [contract.dev](https://contract.dev): watch your mainnet
contracts, track their metrics, alert when a value crosses a line — and work
with a Stagenet from your terminal.

## Install

```bash
npm install contract.dev
```

## Setup

```bash
contract.dev login                   # device-code sign-in, opens the browser
contract.dev whoami                  # the account + workspace the CLI acts as
contract.dev workspace use my-team   # switch the workspace the CLI acts on
```

No config files. The CLI keeps your credentials plus the active workspace in
`~/.contract.dev/credentials.json`. Credentials are workspace-scoped — re-run
`login` with another workspace active to act on it.

## Watch contracts

The workspace's watchlist — the contracts on the home map and /contracts:

```bash
contract.dev watch 0xA0b8... --chain 1                  # named from the token's name() / its verified Etherscan name
contract.dev watch 0xPool... --chain 8453 --name "WETH/USDC pool"
contract.dev watch list [--chain 8453]
contract.dev rename 0xA0b8... "USDC (proxy)" --chain 1  # the name every AccountCell shows; "" clears it
contract.dev unwatch 0xA0b8... --chain 1
```

Contracts are watched per (chain, address); `--chain` disambiguates one
watched on several chains. Wallets are added in the app.

## Track metrics

A tracked metric is an on-chain value sampled over time — charted on /metrics
and the thing a monitor judges. Kinds follow the app's Track Metric picker:

```bash
contract.dev track 0xToken... total-supply --label "USDC supply"
contract.dev track 0xSafe...  native-balance --chain 8453
contract.dev track 0xSafe...  erc20-balance --token 0xToken...
contract.dev track 0xToken... balance-of --holder 0xSafe...
contract.dev track 0xVault... function --function "convertToAssets(uint256) returns (uint256)" --args 1e18 --decimals 18
contract.dev track 0xPair...  function --function "getReserves() returns (uint112,uint112,uint32)" --word 1
contract.dev track 0xPool...  tvl
contract.dev track 0xPool...  calls --method "swap(address,bool,int256,uint160,bytes)" --window 15m
contract.dev track 0xPool...  revert-rate --except 0xBot1...,0xBot2...
```

`function` reads are ABI-encoded locally from the human-readable signature;
`--word` picks one value of a multi-value return, `int` returns are decoded as
signed automatically, `--calldata 0x…` bypasses encoding. The trace-backed
kinds (`calls`, `reverts`, `revert-rate`, `callers`, `gas-p95`) come from the
trace store and are only offered on chains the collector follows.

```bash
contract.dev metrics [--address 0x... --chain 1]        # id, kind, chain, address, label, current value
contract.dev metrics show "USDC supply" --range 7d      # the metric + its history
contract.dev metrics rename <id|label> "New label"
contract.dev metrics pause <id|label> / resume <id|label>
contract.dev metrics decimals <id|label> 6              # display scale — re-interprets stored history
contract.dev untrack <id|label> [...]                   # also removes monitors that read it
```

Anywhere a metric is named, its id or (unambiguous) label works.

## Monitor

A monitor is an alert rule on a tracked metric, an optional warning tier on the
healthy side of it, and the destinations it pages:

```bash
contract.dev channels                                   # alert destinations (connect them in the app's Settings)
contract.dev monitor add "Treasury · Native balance" --below 25000 --warn 30000 --to telegram
contract.dev monitor add "Vault reserves" --below-metric "Vault liabilities" --warn-pct 5 --to "#alerts"
contract.dev monitors                                   # status, rule, open incident
contract.dev monitor show <id|name>
contract.dev monitor set <id|name> --below 20000 --to "#ops"   # edit the rule / warning / destinations
contract.dev monitor snooze <id|name> 2h                # mute pages, keep evaluating
contract.dev monitor pause <id|name> / resume / rename / unsnooze / delete
```

`--to` takes channel ids, labels (`#alerts`) or kinds (`telegram`, when the
workspace has one) — required on `add`, since a monitor with nowhere to send
alerts nobody.

```bash
contract.dev incidents [--days 30] [--limit 50]         # what fired (open episodes are always included)
contract.dev incidents show <id>                        # evidence, deliveries, who acked
contract.dev incidents ack <id> / unack <id>            # stop the reminders; the all-clear still comes
```

## Stagenets

```bash
contract.dev stagenets               # list the active workspace's stagenets
contract.dev stagenet use avax-fork  # pick the one to target (stored per workspace)
```

One-off overrides on any stagenet command: `--stagenet <name>`, or `--rpc-url <url>`
for a direct URL that needs no login at all.

### Push contracts

From your Foundry/Hardhat project root, after `forge build` or `npx hardhat compile`:

```bash
contract.dev push-contracts
```

Each contract becomes a pending Workspace, matched to deployments by bytecode.
Re-run after each rebuild — unchanged contracts are no-ops. Source/artifact dirs
are auto-detected; pass `--contracts <dir>` / `--artifacts <dir>` when your
hardhat.config computes paths dynamically.

## Commands

```
contract.dev login                Connect the CLI to your contract.dev account
contract.dev whoami               Show the signed-in account + workspace
contract.dev workspace            Show/switch the active workspace
contract.dev logout               Delete the saved credentials

contract.dev watch                Watch mainnet contracts
contract.dev rename               Rename a watched contract
contract.dev unwatch              Stop watching a contract

contract.dev metrics              List / show / rename / pause / resume tracked metrics
contract.dev track                Track an on-chain value
contract.dev untrack              Stop tracking

contract.dev monitors             List monitors
contract.dev monitor              Add / show / set / pause / snooze / delete a monitor
contract.dev incidents            List / show / ack alert episodes
contract.dev channels             List alert destinations

contract.dev stagenets            List the workspace's stagenets
contract.dev stagenet use         Set the active stagenet
contract.dev push-contracts       Push compiled artifacts
contract.dev generate-wallet      Generate + fund a wallet
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
