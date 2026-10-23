const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`API request failed (${response.status}): ${path}`);
  return await response.json() as T;
}

export async function fetchCentralHealth() {
  return readJson<{ status: string; service?: string }>('/api/developer2/health');
}

export async function fetchCentralCampaigns() {
  return readJson<Array<Record<string, unknown>>>('/api/developer2/campaigns');
}

export async function fetchCentralCampaignDetail(campaignId: string) {
  return readJson<Record<string, unknown>>(`/api/developer2/campaigns/${encodeURIComponent(campaignId)}`);
}

export async function fetchCentralReports() {
  return readJson<{ reports: Array<Record<string, unknown>> }>('/api/reports?report_type=email&suspicious_only=true');
}

export async function fetchCentralAllReports() {
  return readJson<{ reports: Array<Record<string, unknown>> }>('/api/reports?report_type=email');
}

export async function fetchCentralSuspiciousReports() {
  return fetchCentralReports();
}

export async function fetchCentralOrganizationReports(organizationId: number) {
  return readJson<{ reports: Array<Record<string, unknown>> }>(`/api/reports?report_type=email&suspicious_only=true&organization_id=${organizationId}`);
}

export async function fetchCentralOrganizations() {
  return readJson<Array<{ id: number; name: string; domains: string[] }>>('/api/organizations');
}

export async function fetchCentralReportDetails(reportId: string) {
  return readJson<Record<string, unknown>>(`/api/reports/${encodeURIComponent(reportId)}`);
}

export async function fetchCentralOverview() {
  const [health, campaigns, reportResponse, allReports] = await Promise.all([
    fetchCentralHealth(),
    fetchCentralCampaigns(),
    fetchCentralReports(),
    fetchCentralAllReports()
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
