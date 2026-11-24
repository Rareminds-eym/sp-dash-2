// Encrypted artifact chunks keep their original geometry. Commit only a bounded
// window, using the durable row offset, so restarts never skip records or issues.
export function bulkStagingWindow(rows, offset, limit) {
  const length = rows.records.length + rows.issues.length;
  const start = rows.nextOffset - length;
  if (!Number.isInteger(offset) || offset < start || offset > rows.nextOffset)
    throw new Error('Export staging cursor mismatch');
  const skip = offset - start;
  const records = rows.records.slice(skip, skip + limit);
  const issueStart = Math.max(0, skip - rows.records.length);
  const issues = rows.issues.slice(issueStart, issueStart + limit - records.length);
  const nextOffset = offset + records.length + issues.length;
  return { ...rows, records, issues, nextOffset, done: nextOffset === rows.total };
}
