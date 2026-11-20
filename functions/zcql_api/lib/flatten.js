'use strict';
/**
 * ZCQL returns rows grouped by table, e.g.
 *   [{ Persons: { ROWID: '28...', full_name: 'X' }, Event_Checkins: { badge_type: 'Speaker' } }]
 * Turn that into a simple grid: { columns: ['Persons.ROWID', ...], rows: [[...]] }.
 * Column names are prefixed with the table only when more than one table appears.
 */
function flattenZcql(result) {
  const list = Array.isArray(result) ? result : (result && (result.content || result.data)) || [];
  const columns = [];
  const index = new Map();
  const groups = new Set();
  for (const row of list) for (const [k, v] of Object.entries(row || {})) if (v && typeof v === 'object') groups.add(k);
  const multi = groups.size > 1;

  const flatRows = list.map((row) => {
    const flat = {};
    for (const [k, v] of Object.entries(row || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [c, val] of Object.entries(v)) flat[multi ? `${k}.${c}` : c] = val;
      } else {
        flat[k] = v;
      }
    }
    for (const c of Object.keys(flat)) if (!index.has(c)) { index.set(c, columns.length); columns.push(c); }
    return flat;
  });
  return { columns, rows: flatRows.map((f) => columns.map((c) => (c in f ? f[c] : null))) };
}

/**
 * Catalyst doesn't return columns in SELECT order (e.g. `SELECT ROWID, event_name`
 * comes back as event_name, ROWID). Reorder the grid to follow the query's select list.
 * Columns we can't match (e.g. from SELECT *) keep their original relative order at the end.
 */
function selectItems(query) {
  const masked = query.replace(/'(?:[^']|'')*'/g, (m) => "'" + ' '.repeat(Math.max(0, m.length - 2)) + "'");
  const m = masked.match(/^\s*select\s+(?:distinct\s+)?([\s\S]*?)\s+from\s/i);
  if (!m) return [];
  const start = masked.indexOf(m[1]);
  const text = query.slice(start, start + m[1].length);
  const items = [];
  let depth = 0, cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { items.push(cur); cur = ''; } else cur += ch;
  }
  items.push(cur);
  return items.map((s) => s.trim()).filter(Boolean);
}

const norm = (s) => String(s).replace(/[`\s]/g, '').toLowerCase();

function candidatesFor(item) {
  const alias = item.match(/\s+as\s+`?([\w]+)`?\s*$/i);
  if (alias) return { exact: [norm(alias[1])], suffix: null };
  const k = norm(item);
  const fn = k.match(/^(\w+)\((?:(\w+)\.)?(.+)\)$/); // COUNT(T.col) -> also T.COUNT(col)
  if (fn) {
    const [, f, t, c] = fn;
    return { exact: [k, t ? `${t}.${f}(${c})` : null, `${f}(${c})`].filter(Boolean), suffix: `.${f}(${c})` };
  }
  const dot = k.lastIndexOf('.');
  return dot >= 0 ? { exact: [k, k.slice(dot + 1)], suffix: null } : { exact: [k], suffix: `.${k}` };
}

function orderBySelect(grid, query) {
  const items = selectItems(query);
  if (!items.length || items.some((i) => /(^|\.)\*$/.test(i.trim()))) return grid;
  const remaining = grid.columns.map((c, i) => ({ key: norm(c), i }));
  const order = [];
  for (const item of items) {
    const { exact, suffix } = candidatesFor(item);
    let idx = remaining.findIndex((r) => exact.includes(r.key));
    if (idx < 0 && suffix) idx = remaining.findIndex((r) => r.key.endsWith(suffix));
    if (idx >= 0) order.push(remaining.splice(idx, 1)[0].i);
  }
  order.push(...remaining.map((r) => r.i));
  return { columns: order.map((i) => grid.columns[i]), rows: grid.rows.map((row) => order.map((i) => row[i])) };
}

module.exports = { flattenZcql, orderBySelect };
