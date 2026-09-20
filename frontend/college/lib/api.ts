const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    const response = await fetch(`${baseUrl}/api/reports/${encodeURIComponent(reportId)}`, { cache: 'no-store' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function fetchCollegeReports(): Promise<EmailReport[]> {
  try {
    const response = await fetch(`${baseUrl}/api/reports?report_type=email`, { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return Array.isArray(payload.reports) ? payload.reports : [];
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
