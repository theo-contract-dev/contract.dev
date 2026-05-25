import { callRpc } from './rpc';

export interface StagenetInfo {
  stagenetChainId: number;
  forkChainId: number;
  nativeCurrency: {
    symbol: string;
    name: string;
    decimals: number;
  };
}

// Values are immutable for the life of a stagenet, so we cache the in-flight
// promise per RPC URL. Multiple commands in the same invocation share the
// single round-trip; concurrent callers await the same promise.
const cache = new Map<string, Promise<StagenetInfo>>();

export function fetchStagenetInfo(rpcUrl: string): Promise<StagenetInfo> {
  let pending = cache.get(rpcUrl);
  if (!pending) {
    pending = callRpc<StagenetInfo>(rpcUrl, 'dev_getStagenetInfo', []);
    cache.set(rpcUrl, pending);
  }
  return pending;
}
