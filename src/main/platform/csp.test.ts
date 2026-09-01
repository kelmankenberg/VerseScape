import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from './csp.js';

describe('content security policy', () => {
  const production = contentSecurityPolicy(false);

  it('forbids inline and eval script in production', () => {
    expect(production).toContain("script-src 'self'");
    expect(production).not.toContain('unsafe-inline');
    expect(production).not.toContain('unsafe-eval');
  });

  it('denies everything by default and blocks plugins and framing', () => {
    expect(production).toContain("default-src 'none'");
    expect(production).toContain("object-src 'none'");
    expect(production).toContain("frame-src 'none'");
    expect(production).toContain("base-uri 'none'");
    expect(production).toContain("form-action 'none'");
  });

  it('never allows a remote origin to load script in production', () => {
    expect(production).not.toMatch(/script-src[^;]*https?:/);
  });

  it('relaxes only in development, and only for Vite', () => {
    const development = contentSecurityPolicy(true);
    expect(development).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(development).toContain('ws:');
  });
});
