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

export async function fetchCentralReports() {
  return readJson('/api/reports?suspicious_only=true', { reports: [] as Array<Record<string, unknown>> });
}

export async function fetchCentralSuspiciousReports() {
  return fetchCentralReports();
}

export async function fetchCentralReportDetails(reportId: string) {
  return readJson(`/api/reports/${encodeURIComponent(reportId)}`, null as Record<string, unknown> | null);
}

export async function fetchCentralOverview() {
  const [health, campaigns, reportResponse] = await Promise.all([
    fetchCentralHealth(),
    fetchCentralCampaigns(),
    fetchCentralReports()
  ]);

  return {
    apiStatus: health.status || 'offline',
    campaignCount: campaigns.length,
    reportCount: Array.isArray(reportResponse.reports) ? reportResponse.reports.length : 0,
    environment: 'central',
    baseUrl
  };
}
