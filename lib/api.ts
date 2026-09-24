const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
    return response.ok ? await response.json() : fallback;
  } catch {
    return fallback;
  }
}

export async function fetchCentralHealth() {
  return readJson('/api/developer2/health', { status: 'offline', service: 'unavailable' });
}

export async function fetchCentralCampaigns() {
  return readJson('/api/developer2/campaigns', [] as Array<Record<string, unknown>>);
}

export async function fetchCentralCampaignDetail(campaignId: string) {
  return readJson(
    `/api/developer2/campaigns/${encodeURIComponent(campaignId)}`,
    null as Record<string, unknown> | null
  );
}

export async function fetchCentralReports() {
  return readJson('/api/reports?report_type=email&suspicious_only=true', {
    reports: [] as Array<Record<string, unknown>>
  });
}

export async function fetchCentralSuspiciousReports() {
  return fetchCentralReports();
}

export async function fetchCentralOrganizationReports(organizationId: number) {
  return readJson(
    `/api/reports?report_type=email&suspicious_only=true&organization_id=${organizationId}`,
    { reports: [] as Array<Record<string, unknown>> }
  );
}

export async function fetchCentralOrganizations() {
  return readJson('/api/organizations', [] as Array<{ id: number; name: string; domains: string[] }>);
}

export async function fetchCentralReportDetails(reportId: string) {
  return readJson(
    `/api/reports/${encodeURIComponent(reportId)}`,
    null as Record<string, unknown> | null
  );
}

export async function fetchCentralOverview() {
  const [health, campaigns, reportResponse, allReports] = await Promise.all([
    fetchCentralHealth(),
    fetchCentralCampaigns(),
    fetchCentralReports(),
    readJson('/api/reports?report_type=email', { reports: [] as Array<Record<string, unknown>> })
  ]);

  return {
    apiStatus: health.status || 'offline',
    campaignCount: campaigns.length,
    reportCount: Array.isArray(reportResponse.reports) ? reportResponse.reports.length : 0,
    totalEmailCount: Array.isArray(allReports.reports) ? allReports.reports.length : 0,
    suspiciousCount: Array.isArray(reportResponse.reports) ? reportResponse.reports.length : 0,
    environment: 'central',
    baseUrl
  };
}

export function getApiBaseUrl() {
  return baseUrl;
}
