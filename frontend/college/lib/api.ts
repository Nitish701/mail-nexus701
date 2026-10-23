const baseUrl = typeof window === 'undefined'
  ? (process.env.MAIL_NEXUS_INTERNAL_API_URL || 'http://127.0.0.1:8000')
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

async function organizationQuery() {
  const { cookies } = await import('next/headers');
  const value = (await cookies()).get('mail-nexus-organization-id')?.value;
  return value ? `&organization_id=${encodeURIComponent(value)}` : '';
}

export type EmailReport = {
  report_id: string;
  report_type: string;
  severity: string;
  title: string;
  message_id?: string | null;
  created_at?: string;
};

export type CollegeDashboardSummary = {
  emails_today: number;
  day_timezone: string;
  needs_review: number;
  high_risk: number;
  active_campaign_count: number;
  recent_suspicious_emails: Array<EmailReport & {
    sender?: string | null;
    subject?: string | null;
  }>;
  active_campaigns: Array<{
    campaign_id: string;
    summary?: string | null;
    email_count?: number | null;
    last_seen?: string | null;
  }>;
};

export type CorrelationMember = {
  fingerprint_id: number;
  tenant_id: string;
  similarity: number | null;
  correlation_distance: number | null;
  fingerprint_type: string;
  source_ip: string | null;
  sender_domain: string | null;
  subject: string | null;
  message_id: string | null;
  risk_score: number | null;
  observed_at: string | null;
  geo_country: string | null;
  match_reasons: string[];
  related_members: Array<{
    fingerprint_id: number;
    signals: string[];
    subject: string | null;
    observed_at: string | null;
  }>;
  hidden_related_count: number;
};

export type CorrelationEdge = {
  source_fingerprint_id: number;
  matched_fingerprint_id: number;
  match_method: string;
  similarity: number;
  correlation_distance: number | null;
  matched_at: string | null;
};

export type CorrelationCampaign = {
  [key: string]: unknown;
  campaign_id: string;
  status: string;
  first_seen: string | null;
  last_seen: string | null;
  email_count: number;
  tenant_count: number;
  summary: string | null;
  cross_organization_matches_hidden: boolean;
  correlation_window_minutes: number;
  tlsh_max_distance: number;
  members: CorrelationMember[];
  correlations: CorrelationEdge[];
  hidden_correlation_count: number;
  historical_links_unavailable: boolean;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeCorrelationMember(value: unknown): CorrelationMember | null {
  if (!isObjectRecord(value) || typeof value.fingerprint_id !== 'number') return null;

  const relatedMembers = Array.isArray(value.related_members)
    ? value.related_members.flatMap((related) => {
      if (!isObjectRecord(related) || typeof related.fingerprint_id !== 'number') return [];
      return [{
        fingerprint_id: related.fingerprint_id,
        signals: Array.isArray(related.signals)
          ? related.signals.filter((signal): signal is string => typeof signal === 'string')
          : [],
        subject: nullableString(related.subject),
        observed_at: nullableString(related.observed_at),
      }];
    })
    : [];

  return {
    fingerprint_id: value.fingerprint_id,
    tenant_id: typeof value.tenant_id === 'string' ? value.tenant_id : 'Unavailable',
    similarity: nullableNumber(value.similarity),
    correlation_distance: nullableNumber(value.correlation_distance),
    fingerprint_type: typeof value.fingerprint_type === 'string' ? value.fingerprint_type : 'Unavailable',
    source_ip: nullableString(value.source_ip),
    sender_domain: nullableString(value.sender_domain),
    subject: nullableString(value.subject),
    message_id: nullableString(value.message_id),
    risk_score: nullableNumber(value.risk_score),
    observed_at: nullableString(value.observed_at),
    geo_country: nullableString(value.geo_country),
    match_reasons: Array.isArray(value.match_reasons)
      ? value.match_reasons.filter((reason): reason is string => typeof reason === 'string')
      : [],
    related_members: relatedMembers,
    hidden_related_count: nullableNumber(value.hidden_related_count) ?? 0,
  };
}

function normalizeCorrelationEdge(value: unknown): CorrelationEdge | null {
  if (
    !isObjectRecord(value)
    || typeof value.source_fingerprint_id !== 'number'
    || typeof value.matched_fingerprint_id !== 'number'
    || typeof value.match_method !== 'string'
    || typeof value.similarity !== 'number'
  ) {
    return null;
  }
  return {
    source_fingerprint_id: value.source_fingerprint_id,
    matched_fingerprint_id: value.matched_fingerprint_id,
    match_method: value.match_method,
    similarity: value.similarity,
    correlation_distance: nullableNumber(value.correlation_distance),
    matched_at: nullableString(value.matched_at),
  };
}

function normalizeCorrelationCampaign(value: unknown): CorrelationCampaign | null {
  if (
    !isObjectRecord(value)
    || typeof value.campaign_id !== 'string'
    || typeof value.status !== 'string'
  ) {
    return null;
  }
  return {
    ...value,
    members: Array.isArray(value.members)
      ? value.members.flatMap((member) => {
        const normalized = normalizeCorrelationMember(member);
        return normalized ? [normalized] : [];
      })
      : [],
    correlations: Array.isArray(value.correlations)
      ? value.correlations.flatMap((edge) => {
        const normalized = normalizeCorrelationEdge(edge);
        return normalized ? [normalized] : [];
      })
      : [],
  } as CorrelationCampaign;
}

export async function fetchCollegeDashboardSummary(): Promise<CollegeDashboardSummary | null> {
  const organization = (await organizationQuery()).replace(/^&/, '');
  const response = await fetch(`${baseUrl}/api/reports/dashboard${organization ? `?${organization}` : ''}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
  return await response.json() as CollegeDashboardSummary;
}

export async function fetchCollegeReportDetails(reportId: string): Promise<Record<string, unknown> | null> {
  const organization = await organizationQuery();
  const response = await fetch(`${baseUrl}/api/reports/${encodeURIComponent(reportId)}${organization ? `?organization_id=${organization.split('=').pop()}` : ''}`, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Report details request failed (${response.status})`);
  return await response.json() as Record<string, unknown>;
}

export async function fetchCollegeReports(): Promise<EmailReport[]> {
  const response = await fetch(`${baseUrl}/api/reports?report_type=email${await organizationQuery()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Email reports request failed (${response.status})`);
  const payload = await response.json();
  if (!Array.isArray(payload.reports)) throw new Error('Email reports response was invalid');
  return payload.reports;
}

export async function fetchCollegeCampaigns(): Promise<CorrelationCampaign[]> {
  const organization = await organizationQuery();
  const response = await fetch(`${baseUrl}/api/developer2/campaigns${organization ? `?${organization.slice(1)}` : ''}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Campaigns request failed (${response.status})`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('Campaigns response was invalid');
  return payload.flatMap((campaign) => {
    const normalized = normalizeCorrelationCampaign(campaign);
    return normalized ? [normalized] : [];
  });
}

export async function fetchCollegeOverview() {
  const [healthResponse, reports] = await Promise.all([
    fetch(`${baseUrl}/health`, { cache: 'no-store' }),
    fetchCollegeReports()
  ]);
  if (!healthResponse.ok) throw new Error(`Health request failed (${healthResponse.status})`);
  const health = await healthResponse.json() as { status?: string };

  return {
    apiStatus: health.status || 'unknown',
    reportCount: reports.length,
    environment: 'college',
    baseUrl
  };
}
