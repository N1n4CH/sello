import { useCallback, useState } from 'react';
import Merchant from './pages/Merchant.jsx';
import Customer from './pages/Customer.jsx';
import ScorePage from './pages/Score.jsx';
import { loadLedger } from './lib/receipt.js';

const TABS = [
  { id: 'merchant', label: 'Counter' },
  { id: 'customer', label: 'Phone' },
  { id: 'score', label: 'Score' }
];

export default function App() {
  const [tab, setTab] = useState('merchant');
  const [entries, setEntries] = useState(() => loadLedger());

  const handleLedgerChange = useCallback((next) => setEntries(next), []);

  return (
    <div className="app">
      <nav className="tabs" aria-label="Demo screens">
        <p className="brand">Local Spend Score</p>
        <div className="tab-list">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main>
        {tab === 'merchant' && <Merchant />}
        {tab === 'customer' && <Customer onLedgerChange={handleLedgerChange} />}
        {tab === 'score' && (
          <ScorePage entries={entries} onReset={() => setEntries([])} />
        )}
      </main>

      <footer>
        <p>
          The receipt is read once on the customer's device and discarded. The
          merchant signature is the trust boundary; in production the attestation
          moves into a TEE.
        </p>
      </footer>
    </div>
  );
}
