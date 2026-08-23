import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  loadMerchantWallet,
  signReceipt,
  encodePayload,
  receiptId
} from '../lib/receipt.js';

const PRESETS = [
  { merchant: 'Peluqueria Marta', items: ['Corte', 'Brushing'], amount: 18000 },
  { merchant: 'Cafe Lezama', items: ['Cafe con leche', 'Medialunas'], amount: 4200 },
  { merchant: 'Carrefour Express', items: ['Shampoo', 'Agua 1.5L'], amount: 9800 }
];

export default function Merchant() {
  const [wallet, setWallet] = useState(null);
  const [merchant, setMerchant] = useState(PRESETS[0].merchant);
  const [items, setItems] = useState(PRESETS[0].items.join(', '));
  const [amount, setAmount] = useState(String(PRESETS[0].amount));
  const [qr, setQr] = useState(null);
  const [payload, setPayload] = useState('');
  const [id, setId] = useState('');

  useEffect(() => {
    setWallet(loadMerchantWallet());
  }, []);

  async function issue() {
    if (!wallet) return;
    const receipt = {
      merchant: merchant.trim(),
      items: items.split(',').map((s) => s.trim()).filter(Boolean),
      amount: Number(amount),
      currency: 'ARS',
      issuedAt: Date.now()
    };
    const signed = await signReceipt(wallet, receipt);
    const encoded = encodePayload(signed);
    setPayload(encoded);
    setId(receiptId(signed));
    setQr(await QRCode.toDataURL(encoded, { margin: 1, width: 320 }));
  }

  function usePreset(preset) {
    setMerchant(preset.merchant);
    setItems(preset.items.join(', '));
    setAmount(String(preset.amount));
    setQr(null);
    setPayload('');
  }

  return (
    <section className="stack">
      <header className="screen-head">
        <p className="eyebrow">Counter</p>
        <h1>Issue a signed receipt</h1>
        <p className="lede">
          The shop signs the sale with its own key. That signature is what stops a
          customer inventing purchases that never happened.
        </p>
      </header>

      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p.merchant} className="chip" onClick={() => usePreset(p)}>
            {p.merchant}
          </button>
        ))}
      </div>

      <div className="card form">
        <label>
          Business name
          <input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
        </label>
        <label>
          Items, comma separated
          <input value={items} onChange={(e) => setItems(e.target.value)} />
        </label>
        <label>
          Amount
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <button className="primary" onClick={issue}>Sign receipt</button>
      </div>

      {wallet && (
        <p className="meta">Signing key {wallet.address.slice(0, 10)}…{wallet.address.slice(-6)}</p>
      )}

      {qr && (
        <div className="receipt">
          <div className="receipt-body">
            <p className="receipt-line"><span>Receipt</span><span>{id}</span></p>
            <img src={qr} alt="Signed receipt QR code" />
            <p className="receipt-note">
              Hand the phone over, or open the customer screen in a second tab and
              paste the payload below.
            </p>
            <textarea readOnly value={payload} rows={3} onFocus={(e) => e.target.select()} />
          </div>
        </div>
      )}
    </section>
  );
}
