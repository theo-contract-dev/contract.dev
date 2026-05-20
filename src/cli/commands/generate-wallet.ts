import { Wallet } from 'ethers';
import { loadConfig, resolveRpcUrl } from '../config';
import { callRpc } from '../rpc';

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
  const { config } = loadConfig();
  const rpcUrl = resolveRpcUrl(config);

  const wallet = Wallet.createRandom();

  console.log('Generated wallet');
  console.log(`  Address:     ${wallet.address}`);
  console.log(`  Private key: ${wallet.privateKey}`);
  console.log('  (save the private key now — it is not stored)');

  console.log('\nFunding wallet...');
  await callRpc<AddBalanceResult>(rpcUrl, 'dev_addBalance', [
    wallet.address,
    FUND_AMOUNT_WEI,
  ]);

  console.log('Funded with 1,000,000 native tokens.');

  return { address: wallet.address, privateKey: wallet.privateKey };
}
