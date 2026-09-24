'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const STORAGE_KEY = 'mail-nexus-college-context';

type CollegeContext = { organizationId: number | null; domain: string; collegeName: string };

export function CollegeDomainGate({ children }: { children: ReactNode }) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Mail-Nexus Organization Security Portal';
  const [context, setContext] = useState<CollegeContext | null>(null);
  const [domain, setDomain] = useState('college-example.edu.in');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [domains, setDomains] = useState('');
  const [existingDomain, setExistingDomain] = useState('');

  useEffect(() => {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setContext(JSON.parse(saved)); } catch { window.sessionStorage.removeItem(STORAGE_KEY); }
    }
  }, []);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/college/verify-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() })
      });
      if (!response.ok) throw new Error('unverified');
      const result = await response.json() as { organization_id: number | null; domain: string; organization_name: string };
      const next = { organizationId: result.organization_id, domain: result.domain, collegeName: result.organization_name };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (result.organization_id) document.cookie = `mail-nexus-organization-id=${encodeURIComponent(String(result.organization_id))}; path=/; SameSite=Lax`;
      setContext(next);
    } catch {
      setError("We couldn't verify this college domain. Please check the domain and try again.");
    } finally { setBusy(false); }
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/organizations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, domains: domains.split(/[,\s]+/).filter(Boolean) })
      });
      if (response.status === 409) {
        const duplicate = domains.split(/[,\s]+/).filter(Boolean)[0] || '';
        setExistingDomain(duplicate);
        throw new Error('already registered');
      }
      if (!response.ok) throw new Error('registration failed');
      const result = await response.json() as { id: number; name: string; domains: string[] };
      const next = { organizationId: result.id, domain: result.domains[0], collegeName: result.name };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      document.cookie = `mail-nexus-organization-id=${encodeURIComponent(String(result.id))}; path=/; SameSite=Lax`;
      setContext(next);
    } catch (registrationError) {
      setError(registrationError instanceof Error && registrationError.message === 'already registered'
        ? 'This domain is already registered to an organization. Use the existing organization below.'
        : 'We could not register this organization. Check the name and domain list.');
    } finally { setBusy(false); }
  }

  if (context) return <>{children}</>;

  return (
    <main className="domain-gate">
      <section className="domain-panel">
        <div className="live-indicator"><span className="live-dot" /> LIVE</div>
        <div className="eyebrow">Mail Nexus</div>
        <h1>{appName}</h1>
        <p>Enter your institutional domain to open its email security workspace.</p>
        {!registering ? <form onSubmit={verify} className="domain-form">
          <label htmlFor="college-domain">College domain</label>
          <input id="college-domain" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="college-example.edu.in" autoComplete="organization" />
          <button type="submit" disabled={busy || !domain.trim()}>{busy ? 'Verifying...' : 'Continue'}</button>
        </form> : <form onSubmit={register} className="domain-form">
          <label htmlFor="organization-name">Organization name</label>
          <input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Organization A" />
          <label htmlFor="organization-domains">Email domains</label>
          <input id="organization-domains" value={domains} onChange={(event) => setDomains(event.target.value)} placeholder="college.edu.in dept.college.edu.in" />
          <button type="submit" disabled={busy || !name.trim() || !domains.trim()}>{busy ? 'Registering...' : 'Register organization'}</button>
        </form>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {existingDomain && <button type="button" className="text-button" onClick={() => { setDomain(existingDomain); setRegistering(false); setError(''); setExistingDomain(''); }}>Use existing organization for {existingDomain}</button>}
        <button type="button" className="text-button" onClick={() => { setRegistering(!registering); setError(''); }}>{registering ? 'Use an existing organization domain' : 'Register a new organization'}</button>
      </section>
    </main>
  );
}

export function getCollegeContext() {
  if (typeof window === 'undefined') return null;
  const saved = window.sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try { return JSON.parse(saved) as CollegeContext; } catch { return null; }
}