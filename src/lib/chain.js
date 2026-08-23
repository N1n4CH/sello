import { BrowserProvider, Contract, JsonRpcProvider } from 'ethers';

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ?? '0x0000000000000000000000000000000000000000';

export const READ_RPC_URL = import.meta.env.VITE_RPC_URL ?? '';

export const EXPLORER_BASE =
  import.meta.env.VITE_EXPLORER_BASE ?? 'https://sepolia.etherscan.io';

export const ABI = [
  'function submitScore(uint8 score, uint32 visits, bytes32 sigRef) external',
  'function scoreOf(address customer) external view returns (uint8 score, uint32 visits, bytes32 sigRef, uint64 updatedAt)',
  'event ScoreSubmitted(address indexed customer, uint8 score, uint32 visits, bytes32 sigRef, uint64 timestamp)',
  'error ScoreOutOfRange(uint8 score)',
  'error MissingSignatureRef()'
];

export function isConfigured() {
  return /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS) &&
    CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';
}

function pickMetaMask() {
  const eth = window.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers)) {
    return eth.providers.find((p) => p.isMetaMask) ?? eth.providers[0];
  }
  return eth;
}

export async function connectWallet() {
  const injected = pickMetaMask();
  if (!injected) {
    throw new Error('No browser wallet found. Install MetaMask to publish a score.');
  }
  const provider = new BrowserProvider(injected);
  await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();
  return { provider, signer, address: await signer.getAddress() };
}

export async function submitScore({ signer, score, visits, sigRef }) {
  const code = await signer.provider.getCode(CONTRACT_ADDRESS);
  if (code === '0x') {
    throw new Error(`No contract at ${CONTRACT_ADDRESS} on this network.`);
  }
  if (!sigRef || /^0x0+$/.test(sigRef)) {
    throw new Error('This visit has no merchant signature. Clear the device and add a fresh receipt.');
  }

  const contract = new Contract(CONTRACT_ADDRESS, ABI, signer);
  const data = contract.interface.encodeFunctionData('submitScore', [score, visits, sigRef]);

  const tx = await signer.sendTransaction({
    to: CONTRACT_ADDRESS,
    data,
    gasLimit: 150000n
  });

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