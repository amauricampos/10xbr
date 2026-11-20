import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, hashPassword, importDataKey, open, seal, toB64, totpCode, totpVerify } from '../worker/crypto';
import { cleanFilename, sniff } from '../worker/storage';

describe('crypto', () => {
  it('matches the RFC 6238 SHA-1 test vectors', async () => {
    const secret = base32Encode(new TextEncoder().encode('12345678901234567890'));
    expect(await totpCode(secret, 59_000)).toBe('287082');
    expect(await totpCode(secret, 1111111109_000)).toBe('081804');
    expect(await totpVerify(secret, '081804', 1111111109_000 + 30_000)).toBe(true);
    expect(await totpVerify(secret, '081804', 1111111109_000 + 120_000)).toBe(false);
  });

  it('round-trips base32', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it('hashes passwords with a per-user salt', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a.hash).not.toBe(b.hash);
    expect((await hashPassword('correct horse battery', a.salt)).hash).toBe(a.hash);
    expect((await hashPassword('wrong horse battery', a.salt)).hash).not.toBe(a.hash);
  });

  it('encrypts documents so tampering is detected', async () => {
    const key = await importDataKey(toB64(crypto.getRandomValues(new Uint8Array(32))));
    const sealed = await seal(key, new TextEncoder().encode('bank statement'));
    expect(new TextDecoder().decode(await open(key, sealed))).toBe('bank statement');
    sealed[20] ^= 1;
    await expect(open(key, sealed)).rejects.toThrow();
    await expect(importDataKey(undefined)).rejects.toThrow(/DOC_KEY/);
  });
});

describe('upload validation', () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  it('accepts a real PDF and rejects a renamed executable', () => {
    expect(sniff('return.pdf', pdf)).toBe('application/pdf');
    expect(sniff('return.pdf', new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
    expect(sniff('setup.exe', pdf)).toBeNull();
    expect(sniff('page.html', new TextEncoder().encode('<script>'))).toBeNull();
    expect(sniff('data.csv', new Uint8Array([65, 0, 66]))).toBeNull();
  });

  it('strips paths and unsafe characters from file names', () => {
    expect(cleanFilename('../../etc/passwd')).toBe('passwd');
    expect(cleanFilename('C:\\x\\Declaração 2025 <final>.pdf')).toBe('Declaração 2025 _final_.pdf');
  });
});
