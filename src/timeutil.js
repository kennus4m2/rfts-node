/** ISO 8601 in UTC, like 2026-10-05T09:00:00Z (Hub Contract Rule 6). */
function iso(value) {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

module.exports = { iso };
