export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? 'Something went wrong. Try again.');
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b ?? {}),
  del: <T>(p: string) => request<T>('DELETE', p),
};

export type User = { id: string; email: string; name: string; role: 'applicant' | 'staff'; lang: 'en' | 'pt'; totp_enabled: number };
export type Config = { entity: string; openSignup: boolean; setupNeeded: boolean; ai: boolean };

export type AiResult = {
  doc_type: string;
  matches_request: 'yes' | 'partly' | 'no';
  concerns: string[];
  period?: string;
  summary?: string;
  key_facts?: { label: string; value: string }[];
};
export type Doc = {
  id: string;
  item_key: string;
  filename: string;
  size: number;
  ai_status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  ai_result: AiResult | null;
  review: 'received' | 'accepted' | 'rejected';
  review_note: string | null;
  created_at: number;
};
export type Decision = { verdict: 'proceed' | 'conditions' | 'stop'; summary: string; conditions: string[]; by: string; at: number };
export type Case = {
  id: string;
  company_name: string;
  country: string;
  currency: string;
  stage: number;
  status: 'active' | 'stopped' | 'decided';
  s1_answers: Record<string, string> | null;
  s1_result: import('../shared/process').Stage1Result | null;
  s2_answers: Record<string, number | string> | null;
  s2_result: import('../shared/process').Stage2Result | null;
  overrides: { stage: number; reason: string; by: string; at: number }[];
  folder_url: string | null;
  decision: Decision | null;
  decision_released: boolean;
  applicant: { name: string; email: string } | null;
  signatures: { kind: 'nda' | 'background_consent'; version: string; signer_name: string; signed_at: number }[];
  documents: Doc[];
  checks: { check_key: string; status: import('../shared/documents').CheckStatus; note: string | null }[];
  created_at: number;
  updated_at: number;
};
