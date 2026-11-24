// PostgreSQL returns UTC offsets as +00:00. Use the equivalent ISO Z form
// in query strings: the deployed Next adapter decodes '+' twice. Do not use
// Date.toISOString(), which would discard the cursor's microseconds.
export function cursorTimestamp(timestamp) {
  return timestamp.replace(/\+00:00$/, 'Z');
}
