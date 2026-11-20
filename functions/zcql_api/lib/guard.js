'use strict';
/**
 * Validates a player's ZCQL before it reaches the Data Store.
 * Players only ever get read access, and only to the game's tables.
 * (The function runs with admin scope, so this guard is the gatekeeper.)
 */
const { TABLE_NAMES } = require('./schema');

const MAX_LEN = 2000;
const FORBIDDEN = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|replace|merge|rename)\b/i;
const ALLOWED = new Map(TABLE_NAMES.map((t) => [t.toLowerCase(), t]));

/** Replace the contents of '...' string literals so keywords inside them are ignored. */
function maskStrings(sql) {
  return sql.replace(/'(?:[^']|'')*'/g, (m) => "'" + ' '.repeat(Math.max(0, m.length - 2)) + "'");
}

function validateQuery(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return { ok: false, error: 'Type a ZCQL query first. Try: SELECT * FROM Incident_Reports LIMIT 5' };
  }
  let query = input.trim().replace(/;\s*$/, '');
  if (query.length > MAX_LEN) return { ok: false, error: `Query is too long (max ${MAX_LEN} characters).` };

  const masked = maskStrings(query);
  if ((masked.match(/'/g) || []).length % 2 !== 0) {
    return { ok: false, error: "Unbalanced quote. In ZCQL, text values go in single quotes, e.g. city = 'Hyderabad'." };
  }
  if (masked.includes(';')) return { ok: false, error: 'Only one statement at a time, detective.' };
  if (/--|\/\*/.test(masked)) return { ok: false, error: 'Comments are not allowed in the console.' };
  if (!/^select\b/i.test(masked)) {
    return { ok: false, error: 'This console is read-only: start your query with SELECT. (In your own Catalyst project ZCQL can also INSERT, UPDATE and DELETE.)' };
  }
  const bad = masked.match(FORBIDDEN);
  if (bad) return { ok: false, error: `"${bad[1].toUpperCase()}" is not allowed here: the evidence locker is read-only.` };

  const tableRefs = [...masked.matchAll(/\b(?:from|join)\s+`?([A-Za-z_][\w]*)`?/gi)].map((m) => m[1]);
  if (!tableRefs.length) return { ok: false, error: 'Every SELECT needs a FROM <table>. Check the schema for table names.' };
  for (const t of tableRefs) {
    if (!ALLOWED.has(t.toLowerCase())) {
      return { ok: false, error: `Unknown table "${t}". Case files available: ${TABLE_NAMES.join(', ')}.` };
    }
  }
  return { ok: true, query, tables: tableRefs };
}

module.exports = { validateQuery, maskStrings };
