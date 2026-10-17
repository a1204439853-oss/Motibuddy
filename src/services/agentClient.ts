import { agentRequestSchema, validateAgentResult, type AgentRequest, type AgentResult } from './agentContracts.ts';

// A local, owner-only gateway. Never route supplier credentials through a client build.
export const AGENT_GATEWAY_URL = 'http://127.0.0.1:8787/api/agent/generate';
export class AgentClientError extends Error {
  constructor(public code: string) { super(code); }
}
const errors = new Set(['ORIGIN_DENIED', 'UNAUTHORIZED', 'RATE_LIMITED', 'REQUEST_IN_PROGRESS', 'INVALID_REQUEST', 'BODY_TOO_LARGE', 'UPSTREAM_BUSY', 'UPSTREAM_REJECTED', 'UPSTREAM_UNAVAILABLE', 'INVALID_MODEL_RESULT']);
let session: { token: string; expiresAt: number; owner: string } | null = null;
export function clearAgentConnection() { session = null; }
export async function automaticSession(owner: string, signal: AbortSignal): Promise<string> {
  if (session?.owner === owner && session.expiresAt > Date.now() + 5000) return session.token;
  const response = await fetch(AGENT_GATEWAY_URL.replace('/generate', '/session'), {
    method: 'POST', credentials: 'omit', redirect: 'error', signal,
    headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  const value = await response.json();
  if (!response.ok) throw new AgentClientError(errors.has(value.error) ? value.error : 'GATEWAY_UNAVAILABLE');
  if (!/^mbs_[a-f0-9]{64}$/.test(value.token) || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) throw new AgentClientError('GATEWAY_UNAVAILABLE');
  if (signal.aborted) throw new AgentClientError('CANCELLED');
  session = { token: value.token, expiresAt: value.expiresAt, owner };
  return value.token;
}
export async function generateAgentResult(request: AgentRequest, owner: string, signal: AbortSignal): Promise<AgentResult> {
  const input = agentRequestSchema.parse(request);
  let response: Response;
  try {
    const token = await automaticSession(owner, signal);
    response = await fetch(AGENT_GATEWAY_URL, {
      method: 'POST', credentials: 'omit', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof AgentClientError) throw error;
    throw new AgentClientError(signal.aborted ? 'CANCELLED' : 'GATEWAY_UNAVAILABLE');
  }
  try {
    const envelope = await response.json();
    if (!response.ok) { if (response.status === 401) clearAgentConnection(); throw new AgentClientError(errors.has(envelope.error) ? envelope.error : 'GATEWAY_UNAVAILABLE'); }
    return validateAgentResult(envelope.result, input);
  } catch (error) {
    if (error instanceof AgentClientError) throw error;
    throw new AgentClientError('INVALID_MODEL_RESULT');
  }
}

export async function prepareAgentImage(file: File, maxEdge = 1800): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) throw new AgentClientError('INVALID_IMAGE');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (image.naturalWidth * image.naturalHeight > 40_000_000 || !image.naturalWidth || !image.naturalHeight) throw new Error();
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d'); if (!context) throw new Error();
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.88);
    if (data.length > 3_000_000) throw new Error();
    return data;
  } catch { throw new AgentClientError('INVALID_IMAGE'); }
  finally { URL.revokeObjectURL(url); }
}
