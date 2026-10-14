import { proxyBackendPost } from '../../../lib/backend-proxy';

export async function POST(request: Request): Promise<Response> {
  return proxyBackendPost('/api/organizations', request);
}