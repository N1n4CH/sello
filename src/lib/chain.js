import { BrowserProvider, Contract, JsonRpcProvider } from 'ethers';

// Fill this in after deploying contracts/LocalSpendScore.sol.
export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ?? '0x0000000000000000000000000000000000000000';

export const READ_RPC_URL = import.meta.env.VITE_RPC_URL ?? '';

export const EXPLORER_BASE =
  import.meta.env.VITE_EXPLORER_BASE ?? 'https://sepolia.basescan.org';

export const ABI = [
  'function submitScore(uint8 score, uint32 visits, bytes32 sigRef) external',
  'function scoreOf(address customer) external view returns (uint8 score, uint32 visits, bytes32 sigRef, uint64 updatedAt)',
  'event ScoreSubmitted(address indexed customer, uint8 score, uint32 visits, bytes32 sigRef, uint64 timestamp)'
];

export function isConfigured() {
  return /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS) &&
    CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('No browser wallet found. Install MetaMask to publish a score.');
  }
  const provider = new BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();
  return { provider, signer, address: await signer.getAddress() };
}

export async function submitScore({ signer, score, visits, sigRef }) {
  const contract = new Contract(CONTRACT_ADDRESS, ABI, signer);
  const tx = await contract.submitScore(score, visits, sigRef);
  const receipt = await tx.wait();
  return receipt.hash ?? tx.hash;
}

export async function readScore(address) {
  const provider = READ_RPC_URL
    ? new JsonRpcProvider(READ_RPC_URL)
    : new BrowserProvider(window.ethereum);
  const contract = new Contract(CONTRACT_ADDRESS, ABI, provider);
  const [score, visits, ref, updatedAt] = await contract.scoreOf(address);
  return {
    score: Number(score),
    visits: Number(visits),
    sigRef: ref,
    updatedAt: Number(updatedAt)
  };
}

export function txUrl(hash) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}
