import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  try {
    const formData = await request.formData();
    const uploadedFile = formData.get('file');
    if (!(uploadedFile instanceof File) || uploadedFile.size === 0) {
      return NextResponse.json({ detail: 'Choose an .eml file before scanning.' }, { status: 400 });
    }
    const message = Buffer.from(await uploadedFile.arrayBuffer());

    const scanResponse = await fetch(`${baseUrl}/api/v1/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'message/rfc822' },
      body: message,
      cache: 'no-store'
    });

    const scan = await scanResponse.json();
    if (!scanResponse.ok) {
      return NextResponse.json({ detail: scan.detail || 'Demo scan failed.' }, { status: scanResponse.status });
    }

    const suspicious = Number(scan.base_score) >= 20;
    let correlation: Record<string, unknown> = { submitted: false };

    if (suspicious) {
      const correlationResponse = await fetch(`${baseUrl}/api/developer2/fingerprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: 'organization-demo',
          message_id: scan.message_id,
          sender: scan.from_address,
          recipient: scan.to_addresses?.[0],
          subject: scan.subject,
          body: scan.fingerprint?.redacted_body,
          fingerprint_hash: scan.fingerprint?.tlsh || scan.fingerprint?.body_sha256,
          fingerprint_type: scan.fingerprint?.tlsh ? 'TLSH' : 'SHA256',
          risk_score: scan.base_score
        }),
        cache: 'no-store'
      });
      correlation = await correlationResponse.json();
      correlation.submitted = correlationResponse.ok;
    }

    return NextResponse.json({
      suspicious,
      baseScore: scan.base_score,
      reportId: scan.report_id,
      correlation
    });
  } catch {
    return NextResponse.json({ detail: 'Backend is unavailable.' }, { status: 503 });
  }
}
