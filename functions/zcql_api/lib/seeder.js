'use strict';
/**
 * Loads seed-data.json into the Catalyst Data Store.
 * Foreign keys in Catalyst point at the parent's ROWID, which only exists after
 * the parent row is inserted, so parents are seeded first and children resolve
 * their FKs by looking up the parent's natural key (full_name / event_name).
 *
 * Each table is a separate call so no single request hits the function timeout.
 */
const { TABLES, TABLE_NAMES } = require('./schema');
const seed = require('../data/seed-data.json');

const BATCH = 100;
const PAGE = 200;

async function selectAll(zcql, table, cols) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await zcql.executeZCQLQuery(`SELECT ${cols.join(', ')} FROM ${table} LIMIT ${offset}, ${PAGE}`);
    const rows = (res || []).map((r) => r[table] || Object.values(r)[0]);
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

async function countRows(zcql, table) {
  const res = await zcql.executeZCQLQuery(`SELECT COUNT(ROWID) FROM ${table}`);
  const first = res && res[0] && Object.values(res[0])[0];
  return Number(first && Object.values(first)[0]) || 0;
}

/** Delete all rows from every game table (children first). */
async function resetAll(app) {
  const zcql = app.zcql();
  const report = {};
  for (const name of [...TABLE_NAMES].reverse()) {
    const table = app.datastore().table(name);
    let deleted = 0;
    for (;;) {
      const res = await zcql.executeZCQLQuery(`SELECT ROWID FROM ${name} LIMIT 0, ${PAGE}`);
      const ids = (res || []).map((r) => (r[name] || Object.values(r)[0]).ROWID);
      if (!ids.length) break;
      await table.deleteRows(ids);
      deleted += ids.length;
    }
    report[name] = deleted;
  }
  return report;
}

/** Insert one table's seed rows, resolving foreign keys to live ROWIDs. */
async function seedTable(app, name) {
  const def = TABLES.find((t) => t.name === name);
  if (!def) throw new Error(`Unknown table ${name}`);
  const zcql = app.zcql();

  const existing = await countRows(zcql, name);
  if (existing > 0) return { table: name, skipped: true, reason: `already has ${existing} rows; reset first` };

  const lookups = {};
  for (const c of def.columns.filter((col) => col.fk)) {
    if (lookups[c.fk.table + c.fk.by]) continue;
    const parentRows = await selectAll(zcql, c.fk.table, ['ROWID', c.fk.by]);
    if (!parentRows.length) throw new Error(`Seed ${c.fk.table} before ${name}`);
    lookups[c.fk.table + c.fk.by] = new Map(parentRows.map((r) => [r[c.fk.by], r.ROWID]));
  }

  const rows = seed[name].map((row) => {
    const rec = {};
    for (const c of def.columns) {
      if (c.fk) {
        const id = lookups[c.fk.table + c.fk.by].get(row[c.fk.from]);
        if (!id) throw new Error(`${name}: no ${c.fk.table} row for "${row[c.fk.from]}"`);
        rec[c.name] = id;
      } else if (row[c.name] !== undefined) {
        rec[c.name] = row[c.name];
      }
    }
    return rec;
  });

  const table = app.datastore().table(name);
  for (let i = 0; i < rows.length; i += BATCH) await table.insertRows(rows.slice(i, i + BATCH));
  return { table: name, inserted: rows.length };
}

async function status(app) {
  const zcql = app.zcql();
  const counts = {};
  for (const name of TABLE_NAMES) {
    try { counts[name] = await countRows(zcql, name); } catch (e) { counts[name] = `ERROR: ${e.message || e}`; }
  }
  const expected = Object.fromEntries(TABLE_NAMES.map((n) => [n, seed[n].length]));
  return { counts, expected };
}

module.exports = { resetAll, seedTable, status };
