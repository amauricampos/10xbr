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

export type User = { id: string; email: string; name: string; role: 'applicant' | 'staff'; lang: 'en' | 'pt'; totp_enabled: number; is_admin: number };
export type Config = { entity: string; openSignup: boolean; setupNeeded: boolean; ai: boolean; mail?: boolean };

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
export type AiReview = {
  summary: string;
  strengths: string[];
  flags: string[];
  mismatches: string[];
  suggestion: 'advance' | 'hold' | 'decline';
  at: number;
  stage: number;
};
export type HistoryEntry = { at: number; by: string; action: 'approve' | 'return' | 'decline' | 'reopen'; stage: number; from: string; note: string };
export type Case = {
  id: string;
  kind: import('../shared/process').Kind;
  company_name: string;
  location: string;
  industry: string;
  stage: number;
  status: import('../shared/process').Status;
  s1_answers: Record<string, string> | null;
  s1_result: import('../shared/process').Stage1Result | null;
  s2_answers: Record<string, number | string> | null;
  s2_result: import('../shared/process').Stage2Result | null;
  s4_answers: import('../shared/process').Stage4Answers | null;
  folder_url: string | null;
  team_note: string | null;
  ai_review: AiReview | null;
  ai_review_status: 'none' | 'running' | 'done' | 'failed';
  history: HistoryEntry[];
  owner: { name: string; email: string } | null;
  signatures: { kind: 'nda'; version: string; signer_name: string; signed_at: number }[];
  documents: Doc[];
  created_at: number;
  updated_at: number;
};
export type CaseSummary = {
  id: string;
  kind: import('../shared/process').Kind;
  company_name: string;
  location: string;
  industry: string;
  stage: number;
  status: import('../shared/process').Status;
  owner_name: string;
  owner_email: string;
  s1_rating: import('../shared/process').Stage1Rating | null;
  s2_rating: import('../shared/process').Stage2Rating | null;
  headline_usd: number | null;
  docs: { received: number; required: number };
  ai_suggestion: AiReview['suggestion'] | null;
  ai_flags: number;
  created_at: number;
  updated_at: number;
};

export type Lead = {
  id: string;
  email: string;
  name: string;
  kind: import('../shared/process').Kind;
  lang: 'en' | 'pt';
  s1_rating: import('../shared/process').Stage1Rating;
  s1_answers: Record<string, string>;
  updated_at: number;
  scorecard_sent_at: number | null;
  cleared_at: number | null;
  cleared_by: string | null;
};
