'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';

const STORAGE_KEY = 'mail-nexus-college-context';

export type CollegeContext = {
  organizationId: number | null;
  domain: string;
  collegeName: string;
};

export function CollegeDomainGate({ children }: { children: ReactNode }) {
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
      try {
        setContext(JSON.parse(saved));
      } catch {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/college/verify-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() })
      });
      if (!response.ok) throw new Error('unverified');
      const result = (await response.json()) as {
        organization_id: number | null;
        domain: string;
        organization_name: string;
      };
      const next: CollegeContext = {
        organizationId: result.organization_id,
        domain: result.domain,
        collegeName: result.organization_name
      };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (result.organization_id) {
        document.cookie = `mail-nexus-organization-id=${encodeURIComponent(
          String(result.organization_id)
        )}; path=/; SameSite=Lax`;
      }
      setContext(next);
    } catch {
      setError("Unable to verify this institution domain. Please verify spelling or register below.");
    } finally {
      setBusy(false);
    }
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          domains: domains.split(/[,\s]+/).map((d) => d.trim()).filter(Boolean)
        })
      });
      if (response.status === 409) {
        const duplicate = domains.split(/[,\s]+/).map((d) => d.trim()).filter(Boolean)[0] || '';
        setExistingDomain(duplicate);
        throw new Error('already registered');
      }
      if (!response.ok) throw new Error('registration failed');
      const result = (await response.json()) as { id: number; name: string; domains: string[] };
      const next: CollegeContext = {
        organizationId: result.id,
        domain: result.domains[0] || 'college.edu.in',
        collegeName: result.name
      };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      document.cookie = `mail-nexus-organization-id=${encodeURIComponent(
        String(result.id)
      )}; path=/; SameSite=Lax`;
      setContext(next);
    } catch (registrationError) {
      setError(
        registrationError instanceof Error && registrationError.message === 'already registered'
          ? 'This domain is already registered to an institution. Select it below.'
          : 'Could not register organization. Please check values.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (context) return <>{children}</>;

  return (
    <div className="gate-screen">
      <div className="gate-panel">
        <div className="gate-head">
          <span className="sidebar-logo-mark" aria-hidden="true">MN</span>
          <div>
            <h1 className="gate-title">Mail-Nexus Security Workspace</h1>
            <p className="gate-desc">Institutional email threat verification and incident triage.</p>
          </div>
        </div>

        {!registering ? (
          <form onSubmit={verify} className="gate-form">
            <div className="form-group">
              <label htmlFor="college-domain" className="form-label">Campus domain</label>
              <input
                id="college-domain"
                type="text"
                className="form-input"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="college-example.edu.in"
                autoComplete="organization"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !domain.trim()}
            >
              {busy ? 'Verifying node...' : 'Enter security workspace'}
            </button>
          </form>
        ) : (
          <form onSubmit={register} className="gate-form">
            <div className="form-group">
              <label htmlFor="organization-name" className="form-label">Institution name</label>
              <input
                id="organization-name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. National Institute of Tech"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="organization-domains" className="form-label">Email domain(s)</label>
              <input
                id="organization-domains"
                type="text"
                className="form-input"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder="nit.edu.in dept.nit.edu.in"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !name.trim() || !domains.trim()}
            >
              {busy ? 'Registering institution...' : 'Register campus'}
            </button>
          </form>
        )}

        {error && <div className="form-error-text" role="alert">{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
          {existingDomain && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ justifyContent: 'flex-start', padding: 0 }}
              onClick={() => {
                setDomain(existingDomain);
                setRegistering(false);
                setError('');
                setExistingDomain('');
              }}
            >
              Use existing scope for {existingDomain} →
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ justifyContent: 'flex-start', padding: 0, color: 'var(--text-muted)' }}
            onClick={() => {
              setRegistering(!registering);
              setError('');
            }}
          >
            {registering ? '← Back to domain lookup' : 'Register a new institutional domain'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function getCollegeContext(): CollegeContext | null {
  if (typeof window === 'undefined') return null;
  const saved = window.sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as CollegeContext;
  } catch {
    return null;
  }
}
