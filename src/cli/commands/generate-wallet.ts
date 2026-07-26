import { Wallet } from 'ethers';
import { resolveStagenetRpcUrl } from '../target';
import { callRpc } from '../rpc';
import { fetchStagenetInfo } from '../stagenet-info';

interface AddBalanceResult {
  address: string;
  balance: string;
}

// 1,000,000 native tokens in wei (10^6 * 10^18 = 10^24).
const FUND_AMOUNT_WEI = '1000000000000000000000000';

export interface GeneratedWallet {
  address: string;
  privateKey: string;
}

export async function generateWalletCommand(): Promise<GeneratedWallet> {
  const rpcUrl = await resolveStagenetRpcUrl();

  const wallet = Wallet.createRandom();

  console.log('Generated wallet');
  console.log(`  Address:     ${wallet.address}`);
  console.log(`  Private key: ${wallet.privateKey}`);

  console.log('\nSave the private key now — it is not stored.');

  console.log('\nFunding wallet...');
  const [info] = await Promise.all([
    fetchStagenetInfo(rpcUrl),
    callRpc<AddBalanceResult>(rpcUrl, 'dev_addBalance', [
      wallet.address,
      FUND_AMOUNT_WEI,
    ]),
  ]);

  console.log(`Funded with 1,000,000 ${info.nativeCurrency.symbol}.`);

  return { address: wallet.address, privateKey: wallet.privateKey };
}
