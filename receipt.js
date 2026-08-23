import { Wallet, verifyMessage, keccak256, toUtf8Bytes, getBytes } from 'ethers';

// A receipt payload travels from the merchant's screen to the customer's
// phone as a QR code. It never touches a server. The merchant signs it so the
// customer cannot invent purchases that did not happen.

const MERCHANT_KEY = 'localloyalty.merchant.key';
const LEDGER_KEY = 'localloyalty.ledger';

export function loadMerchantWallet() {
  let pk = localStorage.getItem(MERCHANT_KEY);
  if (!pk) {
    pk = Wallet.createRandom().privateKey;
    localStorage.setItem(MERCHANT_KEY, pk);
  }
  return new Wallet(pk);
}

/** Canonical string that gets signed. Order matters on both sides. */
export function canonical(receipt) {
  return [
    receipt.merchant,
    receipt.items.join('|'),
    receipt.amount,
    receipt.currency,
    receipt.issuedAt
  ].join('\n');
}

export async function signReceipt(wallet, receipt) {
  const message = canonical(receipt);
  const signature = await wallet.signMessage(message);
  return { ...receipt, merchantAddress: wallet.address, signature };
}

export function verifyReceipt(signed) {
  try {
    const recovered = verifyMessage(canonical(signed), signed.signature);
    return recovered.toLowerCase() === signed.merchantAddress.toLowerCase();
  } catch {
    return false;
  }
}

/** What gets published on-chain: a hash of the signature, nothing more. */
export function sigRef(signature) {
  return keccak256(getBytes(signature));
}

export function receiptId(signed) {
  return keccak256(toUtf8Bytes(canonical(signed))).slice(0, 18);
}

export function encodePayload(signed) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(signed))));
}

export function decodePayload(encoded) {
  return JSON.parse(decodeURIComponent(escape(atob(encoded.trim()))));
}

// --- device-local ledger -----------------------------------------------
// Amounts and merchant names stay here, on the phone. Only the score leaves.

export function loadLedger() {
  try {
    return JSON.parse(localStorage.getItem(LEDGER_KEY)) ?? [];
  } catch {
    return [];
  }
}

export function saveLedger(entries) {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(entries));
}

export function clearLedger() {
  localStorage.removeItem(LEDGER_KEY);
}

/** Share of total spend that went to independent businesses, 0-100. */
export function computeScore(entries) {
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  if (total === 0) return 0;
  const local = entries
    .filter((e) => e.independent)
    .reduce((sum, e) => sum + e.amount, 0);
  return Math.round((local / total) * 100);
}
