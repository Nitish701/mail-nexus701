'use client';

import { useState } from 'react';

export function DemoScanButton() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function runDemoScan() {
    if (!selectedFile) {
      setStatus('Choose an .eml file before scanning.');
      return;
    }

    setBusy(true);
    setStatus(`Scanning ${selectedFile.name}...`);

    try {
      const body = new FormData();
      body.append('file', selectedFile);

      const response = await fetch('/api/demo-scan', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || 'Demo scan failed.');
      }

      if (result.suspicious && result.correlation?.submitted) {
        setStatus(`Suspicious message detected. Report ${result.reportId || 'created'} and central correlation submitted.`);
      } else if (result.suspicious) {
        setStatus(`Suspicious message detected. Report ${result.reportId || 'created'}; central correlation could not be submitted.`);
      } else {
        setStatus(`Message scanned with score ${result.baseScore}/70. No central escalation was required.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Demo scan failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #dfeaf6', borderRadius: 14, padding: 18, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Test the live detection pipeline</div>
          <div style={{ color: '#5a6f8a', marginTop: 4 }}>Upload an .eml file for real backend detection.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ border: '1px solid #b9cbe3', borderRadius: 9, padding: '9px 13px', color: '#244b7a', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
            Choose .eml
            <input type="file" accept=".eml,message/rfc822" disabled={busy} onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} style={{ display: 'none' }} />
          </label>
          <button type="button" onClick={runDemoScan} disabled={busy} style={{ border: 0, borderRadius: 9, padding: '10px 16px', background: busy ? '#9fb5d8' : '#1d4ed8', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Scanning...' : 'Scan selected file'}
          </button>
        </div>
      </div>
      {selectedFile && <div style={{ color: '#244b7a', marginTop: 10 }}>Selected: {selectedFile.name}</div>}
      {status && <div style={{ color: '#244b7a', marginTop: 12, lineHeight: 1.5 }}>{status}</div>}
    </div>
  );
}
