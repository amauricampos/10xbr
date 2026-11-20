import { importDataKey, open, seal } from './crypto';
import type { Env } from './env';

/**
 * Document storage. Every file is encrypted with AES-256-GCM under DOC_KEY
 * before it leaves the Worker, so neither R2 nor D1 ever holds plaintext.
 * Files are split into chunks to stay under D1's 2 MB value limit.
 */

const CHUNK = 1024 * 1024;

export async function putFile(env: Env, storageKey: string, data: Uint8Array): Promise<void> {
  const key = await importDataKey(env.DOC_KEY);
  if (env.DOCS) {
    await env.DOCS.put(storageKey, await seal(key, data));
    return;
  }
  const stmts: D1PreparedStatement[] = [];
  for (let i = 0, idx = 0; i < data.length || idx === 0; i += CHUNK, idx++) {
    const sealed = await seal(key, data.subarray(i, i + CHUNK));
    stmts.push(env.DB.prepare('INSERT INTO blobs (storage_key, idx, data) VALUES (?, ?, ?)').bind(storageKey, idx, sealed));
  }
  // One chunk per statement keeps each request body small.
  for (const s of stmts) await s.run();
}

export async function getFile(env: Env, storageKey: string): Promise<Uint8Array | null> {
  const key = await importDataKey(env.DOC_KEY);
  if (env.DOCS) {
    const obj = await env.DOCS.get(storageKey);
    if (!obj) return null;
    return open(key, new Uint8Array(await obj.arrayBuffer()));
  }
  const meta = await env.DB.prepare('SELECT COUNT(*) AS n FROM blobs WHERE storage_key = ?').bind(storageKey).first<{ n: number }>();
  if (!meta || meta.n === 0) return null;
  const parts: Uint8Array[] = [];
  let total = 0;
  for (let idx = 0; idx < meta.n; idx++) {
    const row = await env.DB.prepare('SELECT data FROM blobs WHERE storage_key = ? AND idx = ?')
      .bind(storageKey, idx)
      .first<{ data: ArrayBuffer | number[] }>();
    if (!row) return null;
    const part = await open(key, new Uint8Array(row.data as ArrayBuffer));
    parts.push(part);
    total += part.length;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export async function deleteFile(env: Env, storageKey: string): Promise<void> {
  if (env.DOCS) await env.DOCS.delete(storageKey);
  else await env.DB.prepare('DELETE FROM blobs WHERE storage_key = ?').bind(storageKey).run();
}

/* ---------------- Upload validation ---------------- */

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_FILES_PER_CASE = 200;

const ALLOWED: Record<string, { mime: string; magic?: number[][] }> = {
  pdf: { mime: 'application/pdf', magic: [[0x25, 0x50, 0x44, 0x46]] },
  png: { mime: 'image/png', magic: [[0x89, 0x50, 0x4e, 0x47]] },
  jpg: { mime: 'image/jpeg', magic: [[0xff, 0xd8, 0xff]] },
  jpeg: { mime: 'image/jpeg', magic: [[0xff, 0xd8, 0xff]] },
  webp: { mime: 'image/webp', magic: [[0x52, 0x49, 0x46, 0x46]] },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: [[0x50, 0x4b, 0x03, 0x04]] },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: [[0x50, 0x4b, 0x03, 0x04]] },
  csv: { mime: 'text/csv' },
  txt: { mime: 'text/plain' },
  xml: { mime: 'application/xml' },
  ofx: { mime: 'application/x-ofx' },
};

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED);

/** Returns the canonical MIME type, or null when the file is not acceptable. */
export function sniff(filename: string, data: Uint8Array): string | null {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const rule = ALLOWED[ext];
  if (!rule) return null;
  if (rule.magic && !rule.magic.some((m) => m.every((b, i) => data[i] === b))) return null;
  if (!rule.magic) {
    // Text formats: reject anything with NUL bytes in the first 4 KB.
    for (let i = 0; i < Math.min(data.length, 4096); i++) if (data[i] === 0) return null;
  }
  return rule.mime;
}

export function cleanFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 120) || 'file';
}
