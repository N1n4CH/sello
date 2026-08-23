// Local inference adapter.
//
// The only job here is: given a receipt, decide whether the money went to an
// independent business or to a chain. This runs on the customer's device. The
// receipt text is passed in, used once, and never returned or stored.
//
// Two engines, in order of preference:
//   1. QVAC, if the SDK is present on the page.
//   2. A deterministic fallback so the demo still runs if the SDK is not
//      wired up yet. It reports itself honestly as `fallback`.
//
// IMPORTANT: confirm the exact QVAC JS entry point against the version you
// install. The shape below (load a model, run a completion, get text back) is
// what the adapter expects; if their API differs, change it in this file only.
// Nothing else in the app imports the SDK.

// Change this to whatever the installed package is actually called.
const QVAC_PACKAGE = '@tetherto/qvac-sdk';

const SYSTEM_PROMPT = `You classify retail receipts.
Decide whether the merchant is an independent local business or part of a chain.
Answer with JSON only, no prose, in exactly this shape:
{"independent": true, "confidence": 0.0, "reason": ""}
Keep "reason" under 12 words.`;

let modelPromise = null;

async function loadQvac() {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    // Browser global, if the SDK was loaded via a script tag.
    if (typeof window !== 'undefined' && window.qvac) return window.qvac;

    // Otherwise try the package. The specifier is held in a variable so the
    // bundler leaves it alone and the app still builds before the SDK is
    // installed.
    try {
      const specifier = QVAC_PACKAGE;
      const mod = await import(/* @vite-ignore */ specifier);
      return mod.default ?? mod;
    } catch {
      return null;
    }
  })();

  return modelPromise;
}

async function classifyWithQvac(receiptText) {
  const qvac = await loadQvac();
  if (!qvac) return null;

  const prompt = `${SYSTEM_PROMPT}\n\nReceipt:\n${receiptText}\n\nJSON:`;

  // Adjust this call to match the installed SDK.
  const raw = await qvac.completion({
    prompt,
    maxTokens: 96,
    temperature: 0
  });

  const text = typeof raw === 'string' ? raw : (raw?.text ?? '');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  const parsed = JSON.parse(match[0]);
  return {
    independent: Boolean(parsed.independent),
    confidence: Number(parsed.confidence ?? 0.5),
    reason: String(parsed.reason ?? '').slice(0, 80),
    engine: 'qvac'
  };
}

// Deterministic stand-in. Not the product, just enough to keep the loop alive.
const CHAIN_MARKERS = [
  'carrefour', 'walmart', 'starbucks', 'mcdonald', 'burger king', 'subway',
  'zara', 'h&m', 'dia %', 'mercadona', 'lidl', 'aldi', 'coto', 'jumbo',
  'farmacity', 'day2day', 'sephora', 'decathlon', 'ikea', 'seven eleven',
  '7-eleven', 'oxxo', 'starbucks coffee', 'dunkin'
];

function classifyWithFallback(receiptText) {
  const haystack = receiptText.toLowerCase();
  const hit = CHAIN_MARKERS.find((marker) => haystack.includes(marker));
  return {
    independent: !hit,
    confidence: hit ? 0.9 : 0.6,
    reason: hit ? `matched chain name "${hit}"` : 'no known chain name found',
    engine: 'fallback'
  };
}

/**
 * @param {string} receiptText raw receipt contents, used once and dropped
 * @returns {Promise<{independent:boolean, confidence:number, reason:string, engine:'qvac'|'fallback'}>}
 */
export async function classifyReceipt(receiptText) {
  try {
    const result = await classifyWithQvac(receiptText);
    if (result) return result;
  } catch (err) {
    console.warn('QVAC classification failed, falling back:', err);
  }
  return classifyWithFallback(receiptText);
}
