# Local Spend Score

Portable loyalty for independent shops. A merchant signs a receipt at the
counter. The customer's phone reads that receipt with a model running locally,
works out how much of their spending goes to independent businesses, and
throws the receipt away. Only the score is published.

A shop reading the score learns you are a proven local regular. It does not
learn where you shopped, what you bought, or how much you spent.

## Why this needs local inference

Every digital loyalty programme buys convenience by handing a company your
purchase history. Sending receipts to a hosted model would recreate exactly the
problem the product claims to solve: someone, somewhere, holds an itemised
record of what you buy.

Running the model on the device removes that party. The receipt exists on the
customer's phone for the length of one function call and is never transmitted,
never stored, and never written to the chain.

## The trust boundary, stated plainly

If the phone both reads the receipt and publishes the score, a customer could
skip the receipt and claim any score they like. The merchant signature is what
closes that hole: the shop signs `merchant | items | amount | currency |
issuedAt` with its own key, and the published score carries `sigRef`, the hash
of that signature, as evidence a real purchase backed the update.

This is honest but not complete. The merchant is trusted not to sign fictional
sales, and the classification itself is not attested. In production the
classification moves into a TEE so the customer's device produces a signed
attestation of the model's verdict rather than a bare claim. That is the next
piece of work, not something this prototype does.

## Stack

- Local inference via QVAC, isolated in `src/lib/qvac.js`
- Merchant signing and signature verification with ethers v6
- `contracts/LocalSpendScore.sol`, an EVM contract that stores a score, a visit
  count and a signature reference. No NFT, no metadata, no marketplace.
- React and Vite for the three screens

Contract address: _fill in after deploying_

## Running it

```bash
npm install
npm run dev
```

Then deploy `contracts/LocalSpendScore.sol` (Remix against any EVM testnet is
fastest) and create `.env`:

```
VITE_CONTRACT_ADDRESS=0x...
VITE_RPC_URL=https://...
VITE_EXPLORER_BASE=https://sepolia.basescan.org
```

### Wiring up QVAC

`src/lib/qvac.js` is the only file that touches the SDK. It exposes one
function, `classifyReceipt(text)`, and returns which engine answered. If the
SDK is not present the app falls back to a deterministic classifier and says so
in the interface rather than pretending the model ran. Set `QVAC_PACKAGE` and
adjust the `completion` call to match the installed version.

## Demo

Three screens, two browser tabs, no camera required.

1. **Counter.** Pick a preset shop, sign the receipt, a QR appears.
2. **Phone.** Scan it, or paste the payload from the counter screen. The
   signature is checked, the receipt is classified on-device, the receipt is
   discarded, the score updates.
3. **Score.** Connect a wallet, publish, read it back as a shop would.

Repeat with the chain preset to watch the score drop.

## What is not built

Redemption, multi-merchant onboarding, wallet abstraction for customers, and
attested classification. Scoped deliberately to one working loop.

## Provenance

Written from scratch during the Aleph Hackathon, 22-23 August 2026. Commit
history covers the full build.
