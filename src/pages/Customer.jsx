import { useEffect, useRef, useState } from 'react';
import { classifyReceipt } from '../lib/qvac.js';
import {
  decodePayload,
  verifyReceipt,
  sigRef,
  receiptId,
  loadLedger,
  saveLedger,
  computeScore
} from '../lib/receipt.js';

const STEPS = [
  'Merchant signature checked',
  'Receipt read on this device',
  'Receipt discarded, score kept'
];

export default function Customer({ onLedgerChange }) {
  const [pasted, setPasted] = useState('');
  const [status, setStatus] = useState(null);
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState(null);
  const [entries, setEntries] = useState([]);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    const loaded = loadLedger();
    setEntries(loaded);
    onLedgerChange?.(loaded);
  }, [onLedgerChange]);

  useEffect(() => () => stopScanner(), []);

  async function startScanner() {
    setScanning(true);
    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 240 },
        (text) => {
          stopScanner();
          handlePayload(text);
        },
        () => {}
      );
    } catch (err) {
      setStatus({ kind: 'error', text: `Camera unavailable: ${err.message}. Paste the payload instead.` });
      setScanning(false);
    }
  }

  function stopScanner() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (scanner) scanner.stop().catch(() => {});
  }

  async function handlePayload(raw) {
    setStatus(null);
    setResult(null);
    setStep(-1);

    let signed;
    try {
      signed = decodePayload(raw);
    } catch {
      setStatus({ kind: 'error', text: 'That payload could not be read. Check you copied all of it.' });
      return;
    }

    if (!verifyReceipt(signed)) {
      setStatus({ kind: 'error', text: 'Signature does not match the merchant key. Receipt rejected.' });
      return;
    }
    setStep(0);

    const id = receiptId(signed);
    if (entries.some((e) => e.id === id)) {
      setStatus({ kind: 'error', text: 'This receipt was already counted.' });
      return;
    }

    // The only moment the receipt contents exist in this app. Read once, on
    // this device, then dropped: nothing below keeps `receiptText`.
    const receiptText = `${signed.merchant}\n${signed.items.join('\n')}\n${signed.amount} ${signed.currency}`;
    const verdict = await classifyReceipt(receiptText);
    setStep(1);

    const entry = {
      id,
      amount: signed.amount,
      independent: verdict.independent,
      sigRef: sigRef(signed.signature),
      at: Date.now()
    };

    const next = [...entries, entry];
    setEntries(next);
    saveLedger(next);
    onLedgerChange?.(next);
    setResult({ ...verdict, amount: signed.amount, merchant: signed.merchant });
    setStep(2);
    setPasted('');
  }

  const score = computeScore(entries);

  return (
    <section className="stack">
      <header className="screen-head">
        <p className="eyebrow">Your phone</p>
        <h1>Add a visit</h1>
        <p className="lede">
          The receipt is read here and then thrown away. What survives is one
          number: how much of your spending went to independent shops.
        </p>
      </header>

      <div className="card form">
        <div className="row">
          {scanning ? (
            <button onClick={stopScanner}>Stop camera</button>
          ) : (
            <button onClick={startScanner}>Scan the QR</button>
          )}
        </div>
        <div id="qr-reader" className={scanning ? 'qr-reader active' : 'qr-reader'} />
        <label>
          Or paste the payload
          <textarea rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} />
        </label>
        <button className="primary" onClick={() => handlePayload(pasted)} disabled={!pasted.trim()}>
          Add this visit
        </button>
      </div>

      {status && <p className={`notice ${status.kind}`}>{status.text}</p>}

      {step >= 0 && (
        <ol className="steps">
          {STEPS.map((label, i) => (
            <li key={label} className={i <= step ? 'done' : ''}>{label}</li>
          ))}
        </ol>
      )}

      {result && (
        <div className="card verdict">
          <p className="verdict-tag">{result.independent ? 'Independent' : 'Chain'}</p>
          <p className="verdict-reason">{result.reason}</p>
          <p className="meta">
            Read by {result.engine === 'qvac' ? 'QVAC, on this device' : 'the fallback classifier'}
          </p>
        </div>
      )}

      <div className="card tally">
        <p className="tally-score">{score}<span>/100</span></p>
        <p className="meta">{entries.length} signed {entries.length === 1 ? 'visit' : 'visits'} counted on this device</p>
      </div>
    </section>
  );
}
