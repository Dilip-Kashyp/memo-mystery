'use strict';
/**
 * Local stand-in for the Catalyst Data Store, built on Node's built-in SQLite.
 * It loads the same seed data and emulates the ZCQL rules players must learn:
 *   - LIKE wildcards are * and ? (a literal % or _ matches itself)
 *   - JOIN ... ON must link a foreign-key column to the other table's ROWID
 *   - at most 4 JOINs and 5 WHERE conditions
 *   - every table carries ROWID, CREATORID, CREATEDTIME, MODIFIEDTIME
 * It is a teaching aid, not a perfect clone: the real Catalyst project is the source of truth.
 */
const { DatabaseSync } = require('node:sqlite');
const { TABLES } = require('../functions/zcql_api/lib/schema');
const { maskStrings } = require('../functions/zcql_api/lib/guard');
const seed = require('../functions/zcql_api/data/seed-data.json');

const MAX_ROWS = 300;
const CREATOR = '2849000000000101';
const SQL_TYPE = { VarChar: 'TEXT', Text: 'TEXT', Date: 'TEXT', DateTime: 'TEXT', Int: 'INTEGER', BigInt: 'INTEGER', Double: 'REAL', 'Foreign Key': 'INTEGER', Boolean: 'INTEGER' };
const FK_COLUMNS = new Set(TABLES.flatMap((t) => t.columns.filter((c) => c.fk).map((c) => c.name.toLowerCase())));

function build() {
  const db = new DatabaseSync(':memory:');
  const lookups = {}; // table -> naturalKey -> ROWID
  TABLES.forEach((t, ti) => {
    const cols = t.columns.map((c) => `"${c.name}" ${SQL_TYPE[c.type]}`).join(', ');
    db.exec(`CREATE TABLE ${t.name} (ROWID INTEGER PRIMARY KEY, CREATORID INTEGER, CREATEDTIME TEXT, MODIFIEDTIME TEXT, ${cols})`);
    const names = t.columns.map((c) => c.name);
    const stmt = db.prepare(
      `INSERT INTO ${t.name} (ROWID, CREATORID, CREATEDTIME, MODIFIEDTIME, ${names.map((n) => `"${n}"`).join(', ')}) VALUES (?, ?, ?, ?, ${names.map(() => '?').join(', ')})`
    );
    const uniqueCol = t.columns.find((c) => c.unique);
    lookups[t.name] = {};
    seed[t.name].forEach((row, i) => {
      const rowid = Number(`2849000000${ti + 1}${String(i + 1).padStart(5, '0')}`);
      const created = `2026-11-17 09:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`;
      const vals = t.columns.map((c) => {
        if (!c.fk) return row[c.name] ?? null;
        const id = lookups[c.fk.table][row[c.fk.from]];
        if (id == null) throw new Error(`Seed error: ${t.name}.${c.name} -> unknown ${c.fk.table} "${row[c.fk.from]}"`);
        return id;
      });
      stmt.run(rowid, Number(CREATOR), created, created, ...vals);
      if (uniqueCol) lookups[t.name][row[uniqueCol.name]] = rowid;
    });
  });
  return db;
}

const db = build();

class ZcqlError extends Error {}

function checkZcqlRules(query) {
  const masked = maskStrings(query);
  // JOIN rules
  const joins = [...masked.matchAll(/\bjoin\b/gi)];
  if (joins.length > 4) throw new ZcqlError('ZCQL supports a maximum of 4 JOIN clauses in one query.');
  if (/\b(right|full|cross|outer)\s+join\b/i.test(masked) && !/\bleft\s+outer\s+join\b/i.test(masked)) {
    throw new ZcqlError('ZCQL supports only INNER JOIN and LEFT JOIN.');
  }
  const ons = [...masked.matchAll(/\bon\s+([\w.`]+)\s*=\s*([\w.`]+)/gi)];
  if (ons.length < joins.length) throw new ZcqlError('Every JOIN needs an ON condition of the form Child.fk_column = Parent.ROWID.');
  for (const [, a, b] of ons) {
    const col = (s) => s.replace(/`/g, '').split('.').pop().toLowerCase();
    const okPair = (x, y) => col(x) === 'rowid' && FK_COLUMNS.has(col(y));
    if (!okPair(a, b) && !okPair(b, a)) {
      throw new ZcqlError(`Invalid join condition "${a} = ${b}". In ZCQL, a join must link a foreign key column to the parent table's ROWID (e.g. Event_Checkins.person_id = Persons.ROWID).`);
    }
  }
  // WHERE condition count (outer query only; good enough for the game)
  const where = masked.match(/\bwhere\b([\s\S]*?)(?=\bgroup\s+by\b|\border\s+by\b|\blimit\b|\bhaving\b|$)/i);
  if (where) {
    const clause = where[1].replace(/\bbetween\b[\s\S]+?\band\b/gi, 'BETWEEN_');
    const n = (clause.match(/\b(and|or)\b/gi) || []).length + 1;
    if (n > 5) throw new ZcqlError(`ZCQL allows at most 5 conditions in a WHERE clause (you have ${n}). Split the work across queries.`);
  }
}

/** Translate ZCQL wildcards (* and ?) into SQLite LIKE syntax, escaping literal % and _. */
function translate(query) {
  return query.replace(/(\blike\s+)'((?:[^']|'')*)'/gi, (_, kw, pat) => {
    const p = pat.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/\*/g, '%').replace(/\?/g, '_');
    return `${kw}'${p}' ESCAPE '\\'`;
  });
}

function run(query) {
  checkZcqlRules(query);
  let stmt;
  try {
    stmt = db.prepare(translate(query));
  } catch (e) {
    throw new ZcqlError(`Query error: ${e.message}`);
  }
  stmt.setReturnArrays(true);
  const meta = stmt.columns();
  const tablesInResult = new Set(meta.map((m) => m.table).filter(Boolean));
  const multi = tablesInResult.size > 1;
  const columns = meta.map((m) => (multi && m.table ? `${m.table}.${m.column}` : m.name));
  const all = stmt.all();
  const rows = all.slice(0, MAX_ROWS).map((r) => r.map((v) => (typeof v === 'number' && v > 1e12 ? String(v) : v)));
  return { columns, rows, truncated: all.length > MAX_ROWS };
}

module.exports = { run, ZcqlError };
