export type Env = {
  DB: D1Database;
  AI?: Ai;
  /** Optional R2 bucket. When absent, encrypted chunks are kept in D1. */
  DOCS?: R2Bucket;
  ASSETS: Fetcher;
  APP_NAME: string;
  LEGAL_ENTITY: string;
  AI_MODEL: string;
  OPEN_SIGNUP: string;
  /** Base64 of 32 random bytes. Encrypts documents and TOTP secrets at rest. */
  DOC_KEY?: string;
  /** One-time token that authorizes creating the first staff account. */
  SETUP_TOKEN?: string;
  /** Resend API key. Scorecard emails are sent only when this and MAIL_FROM are set. */
  RESEND_API_KEY?: string;
  /** Sender, e.g. "10xBR <hello@10xbr.com>". The domain must be verified with Resend. */
  MAIL_FROM?: string;
  MAIL_REPLY_TO?: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'applicant' | 'staff';
  lang: 'en' | 'pt';
  totp_enabled: number;
};

export type Vars = { user: User | null; ip: string };
export type AppEnv = { Bindings: Env; Variables: Vars };

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 500 | 503,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const now = () => Date.now();
