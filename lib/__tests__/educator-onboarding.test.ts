import { describe, expect, it } from 'vitest';
import { educatorInvitation, educatorLoginUrl, generateEducatorPassword } from '../educator-onboarding';

describe('educator credentials', () => {
  it('uses SkillPassport localhost and requires an explicit production target', () => {
    expect(educatorLoginUrl(undefined, 'development')).toBe('http://localhost:8788/login');
    expect(() => educatorLoginUrl(undefined, 'production')).toThrow('must be configured');
    expect(() => educatorLoginUrl('http://example.com/login', 'production')).toThrow();
    expect(() => educatorLoginUrl('https://user:secret@example.com/login', 'production')).toThrow();
  });
  it('generates distinct passwords satisfying SSO character classes', () => {
    const a = generateEducatorPassword();
    expect(a).not.toBe(generateEducatorPassword());
    expect(a.length).toBeGreaterThanOrEqual(16);
    for (const pattern of [/[A-Z]/, /[a-z]/, /[0-9]/, /[^a-zA-Z0-9]/]) expect(a).toMatch(pattern);
  });
  it('escapes instructor data and points credentials to the configured learner application', () => {
    const message = educatorInvitation('<Hari>', 'hari@example.com', 'Aa7!123', 'https://skillpassport.example/login');
    expect(message.html).toContain('&lt;Hari&gt;');
    expect(message.html).not.toContain('<Hari>');
    expect(message.to).toBe('hari@example.com');
    expect(message.text).toContain('https://skillpassport.example/login');
    expect(message.type).toBe('send-email');
  });
});
