import { useState } from 'react';
import {
  connectWallet,
  submitScore,
  readScore,
  txUrl,
  isConfigured,
  CONTRACT_ADDRESS
} from '../lib/chain.js';
import { computeScore, clearLedger } from '../lib/receipt.js';

export default function Score({ entries, onReset }) {
  const [account, setAccount] = useState(null);
  const [signer, setSigner] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState(null);
  const [onChain, setOnChain] = useState(null);
  const [error, setError] = useState(null);

  const score = computeScore(entries);
  const latest = entries[entries.length - 1];

  async function connect() {
    setError(null);
    try {
      const { signer: s, address } = await connectWallet();
      setSigner(s);
      setAccount(address);
    } catch (err) {
      setError(err.message);
    }
  }

  async function publish() {
    setError(null);
    setBusy(true);
    try {
      const hash = await submitScore({
        signer,
        score,
        visits: entries.length,
        sigRef: latest.sigRef
      });
      setTx(hash);
    } catch (err) {
      setError(err.shortMessage ?? err.message);
    } finally {
      setBusy(false);
    }
  }

  async function lookUp() {
    setError(null);
    try {
      setOnChain(await readScore(account));
    } catch (err) {
      setError(err.shortMessage ?? err.message);
    }
  }

  function reset() {
    clearLedger();
    onReset?.();
    setTx(null);
    setOnChain(null);
  }

  return (
    <section className="stack">
      <header className="screen-head">
        <p className="eyebrow">Publish</p>
        <h1>Only the score leaves the phone</h1>
        <p className="lede">
          A shop reading this learns you are a proven local regular. It does not
          learn where you shopped, what you bought, or how much you spent.
        </p>
      </header>

      <div className="card tally">
        <p className="tally-score">{score}<span>/100</span></p>
        <p className="meta">{entries.length} signed {entries.length === 1 ? 'visit' : 'visits'}</p>
      </div>

      {!isConfigured() && (
        <p className="notice error">
          No contract address set. Deploy contracts/LocalSpendScore.sol and put the
          address in VITE_CONTRACT_ADDRESS.
        </p>
      )}

      <div className="card form">
        {!account ? (
          <button className="primary" onClick={connect}>Connect wallet</button>
        ) : (
          <>
            <p className="meta">Publishing as {account.slice(0, 10)}…{account.slice(-6)}</p>
            <button
              className="primary"
              onClick={publish}
              disabled={busy || entries.length === 0 || !isConfigured()}
            >
              {busy ? 'Publishing…' : 'Publish score'}
            </button>
            <button onClick={lookUp} disabled={!isConfigured()}>Read it back</button>
          </>
        )}
      </div>

      {error && <p className="notice error">{error}</p>}

      {tx && (
        <p className="notice ok">
          Published. <a href={txUrl(tx)} target="_blank" rel="noreferrer">View the transaction</a>
        </p>
      )}

      {onChain && (
        <div className="card">
          <p className="receipt-line"><span>Score</span><span>{onChain.score}/100</span></p>
          <p className="receipt-line"><span>Visits</span><span>{onChain.visits}</span></p>
          <p className="receipt-line"><span>Signature ref</span><span>{onChain.sigRef.slice(0, 14)}…</span></p>
          <p className="meta">Contract {CONTRACT_ADDRESS}</p>
        </div>
      )}

      <button className="ghost" onClick={reset}>Clear this device</button>
    </section>
  );
}
