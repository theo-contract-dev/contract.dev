import { loadConfig, resolveRpcUrl } from '../config';
import { callRpc } from '../rpc';
import { parseFlags, requireFlag, requirePositional, flag } from './_args';

// Mirrors the server's discriminated AddWorkspaceResult.
type WorkspaceResult =
  | { kind: 'wallet'; wallet: { id: string; address: string; name: string | null } }
  | {
      kind: 'mainnet-contract';
      mainnetProjectContract: { id: string; address: string; name: string; type: string | null };
    }
  | {
      kind: 'manual';
      projectContract: { id: string; name: string };
      projectContractVersion: { id: string };
      projectContractDeployment: { id: string; address: string } | null;
    };

const HELP = `contract.dev workspace — attach a Workspace to an address

Usage:
  contract.dev workspace add <address> --name <name>
  contract.dev workspace add <address> --name <name> --type <ERC20|ERC721>
  contract.dev workspace add <address> --name <name> --abi <json>
  contract.dev workspace add            --name <name> --abi <json>     # ABI-only, no address

The CLI auto-detects which kind of Workspace to create from what you pass:

  - address only, no on-chain code at the address    → wallet Workspace
  - address only, code matches mainnet               → mainnet-contract Workspace
                                                       (ABI fetched from Etherscan)
  - --abi present                                    → manual Workspace
                                                       (with or without address)

If the address has code on your Stagenet that doesn't match mainnet (e.g. a
contract you deployed locally outside push-contracts), the server errors and
tells you to pass --abi or run push-contracts.

Options:
  --name <name>      Display name shown in the dashboard. Required.
  --abi <json>       JSON-encoded ABI. Presence of this flag creates a manual
                     Workspace, even if the address has on-chain code.
  --type <T>         Optional UI hint for mainnet-contract Workspaces.
                     One of: ERC20, ERC721.
`;

export async function workspaceCommand(args: string[]): Promise<WorkspaceResult | void> {
  const [sub, ...rest] = args;

  switch (sub) {
    case 'add':
      return await addSubcommand(rest);
    case 'help':
    case '-h':
    case '--help':
    case undefined:
      console.log(HELP);
      return;
    default:
      console.error(`Unknown workspace subcommand: ${sub}\n`);
      console.error(HELP);
      process.exit(1);
  }
}

async function addSubcommand(args: string[]): Promise<WorkspaceResult> {
  const flags = parseFlags(args);
  const name = requireFlag(flags, 'name');
  const abi = flag(flags, 'abi');
  const type = flag(flags, 'type');

  // Address is the first positional. Allowed to be missing only if --abi was
  // passed (ABI-only manual workspace). We validate that combination here
  // rather than relying on the server's error so the user sees it before the
  // round trip.
  const address = flags._[0];
  if (!address && !abi) {
    throw new Error(
      'Missing required <address>. Pass --abi <json> if you want to create an ABI-only Workspace without an address.',
    );
  }
  if (type && type !== 'ERC20' && type !== 'ERC721') {
    throw new Error('--type must be "ERC20" or "ERC721" if provided');
  }

  const rpcUrl = resolveRpcUrl(loadConfig().config);
  const result = await callRpc<WorkspaceResult>(rpcUrl, 'dev_addWorkspace', [
    {
      ...(address ? { address } : {}),
      name,
      ...(abi ? { abi } : {}),
      ...(type ? { type } : {}),
    },
  ]);

  // Tell the user exactly which kind we ended up creating — closes the loop on
  // the auto-detect so it isn't a mystery what got persisted.
  switch (result.kind) {
    case 'wallet':
      console.log(`Created wallet Workspace for ${result.wallet.address}`);
      console.log(`  id:   ${result.wallet.id}`);
      console.log(`  name: ${result.wallet.name ?? ''}`);
      break;
    case 'mainnet-contract':
      console.log(`Created mainnet-contract Workspace for ${result.mainnetProjectContract.address}`);
      console.log(`  id:   ${result.mainnetProjectContract.id}`);
      console.log(`  name: ${result.mainnetProjectContract.name}`);
      if (result.mainnetProjectContract.type) {
        console.log(`  type: ${result.mainnetProjectContract.type}`);
      }
      break;
    case 'manual':
      console.log(
        `Created manual Workspace for ${result.projectContract.name}` +
          (result.projectContractDeployment
            ? ` at ${result.projectContractDeployment.address}`
            : ' (ABI-only, no address)'),
      );
      console.log(`  contract:   ${result.projectContract.id}`);
      console.log(`  version:    ${result.projectContractVersion.id}`);
      if (result.projectContractDeployment) {
        console.log(`  deployment: ${result.projectContractDeployment.id}`);
      }
      break;
  }
  return result;
}
