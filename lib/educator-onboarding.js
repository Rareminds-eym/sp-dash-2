export function generateEducatorPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `Aa7!${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')}`;
}

export function educatorLoginUrl(configuration, environment = process.env.NODE_ENV) {
  const value = configuration || (environment === 'production' ? null : 'http://localhost:8788/login');
  if (!value) throw new Error('SKILLPASSPORT_LOGIN_URL must be configured');
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(environment !== 'production' && url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Invalid SkillPassport login URL');
  if (url.username || url.password || url.hash || url.search) throw new Error('Invalid SkillPassport login URL');
  return url.toString();
}

const escape = value => String(value).replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);

export function educatorInvitation(name, email, password, loginUrl) {
  return {
    type: 'send-email', to: email, subject: 'Your Rareminds educator account is ready',
    html: `<p>Hello ${escape(name)},</p><p>Rareminds has created your SkillPassport educator account.</p>` +
      `<p><a href="${escape(loginUrl)}">Sign in to SkillPassport</a></p><p>Email: ${escape(email)}</p>` +
      `<p>Temporary password: <strong>${escape(password)}</strong></p>` +
      '<p>Change your password after signing in. Your assigned courses and classes will appear in the educator portal.</p>',
    text: `Hello ${name},\nSign in to SkillPassport: ${loginUrl}\nEmail: ${email}\nTemporary password: ${password}\nChange your password after signing in.`,
  };
}
