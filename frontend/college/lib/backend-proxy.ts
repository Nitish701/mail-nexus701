export async function proxyBackendPost(path: string, request: Request): Promise<Response> {
  try {
    const baseUrl = process.env.MAIL_NEXUS_INTERNAL_API_URL || 'http://127.0.0.1:8000';
    const upstream = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
      cache: 'no-store'
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' }
    });
  } catch {
    return Response.json({ detail: 'Backend service unavailable' }, { status: 502 });
  }
}