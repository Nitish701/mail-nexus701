const baseUrl = typeof window === 'undefined'
  ? (process.env.MAIL_NEXUS_INTERNAL_API_URL || 'http://127.0.0.1:8000')
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

async function organizationQuery() {
  const { cookies } = await import('next/headers');
  const value = cookies().get('mail-nexus-organization-id')?.value;
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

export async function fetchCollegeReportDetails(reportId: string): Promise<Record<string, unknown> | null> {
  try {
    const organization = await organizationQuery();
    const response = await fetch(`${baseUrl}/api/reports/${encodeURIComponent(reportId)}${organization ? `?organization_id=${organization.split('=').pop()}` : ''}`, { cache: 'no-store' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function fetchCollegeReports(): Promise<EmailReport[]> {
  try {
    const response = await fetch(`${baseUrl}/api/reports?report_type=email${await organizationQuery()}`, { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return Array.isArray(payload.reports) ? payload.reports : [];
  } catch {
    return [];
  }
}

export async function fetchCollegeCampaigns(): Promise<Array<Record<string, unknown>>> {
  try {
    const organization = await organizationQuery();
    const response = await fetch(`${baseUrl}/api/developer2/campaigns${organization ? `?${organization.slice(1)}` : ''}`, { cache: 'no-store' });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

export async function fetchCollegeOverview() {

  const [healthResult, reportsResult] = await Promise.allSettled([
    fetch(`${baseUrl}/health`, { cache: 'no-store' }),
    fetchCollegeReports()
  ]);

  let health = { status: 'offline' };
  const reports = reportsResult.status === 'fulfilled' ? reportsResult.value : [];

  if (healthResult.status === 'fulfilled' && healthResult.value.ok) {
    try {
      health = await healthResult.value.json();
    } catch {
      health = { status: 'offline' };
    }
  }

  return {
    apiStatus: health.status || 'offline',
    reportCount: reports.length,
    environment: 'college',
    baseUrl
  };
}
