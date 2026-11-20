'use strict';
/**
 * Advanced I/O function: the game's backend on Zoho Catalyst.
 * Hosted at /server/zcql_api/*
 *
 *   GET  /schema          table definitions for the schema explorer
 *   POST /query           { query }        run a read-only ZCQL query against the Data Store
 *   POST /check           { stage, name }  check a solution (kidnapper | mastermind)
 *   GET  /admin/status    row counts       (header x-admin-key)
 *   POST /admin/reset     wipe game tables (header x-admin-key)
 *   POST /admin/seed      { table }        seed one table (header x-admin-key)
 */
const express = require('express');
const catalyst = require('zcatalyst-sdk-node');
const { TABLES, SYSTEM_COLUMNS, TABLE_NAMES } = require('./lib/schema');
const { validateQuery } = require('./lib/guard');
const { checkAnswer } = require('./lib/game');
const { flattenZcql, orderBySelect } = require('./lib/flatten');
const seeder = require('./lib/seeder');

const MAX_ROWS = 300;
const app = express();
app.use(express.json({ limit: '20kb' }));

function errorText(e) {
  if (!e) return 'Unknown error';
  let msg = e.message || String(e);
  try { const j = JSON.parse(msg); msg = j.message || (j.data && j.data.message) || msg; } catch { /* plain text */ }
  return String(msg).replace(/\s+/g, ' ').slice(0, 500);
}

app.get('/schema', (req, res) => {
  res.json({ tables: TABLES, systemColumns: SYSTEM_COLUMNS, mode: 'catalyst' });
});

app.post('/query', async (req, res) => {
  const v = validateQuery(req.body && req.body.query);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const started = Date.now();
  try {
    const result = await catalyst.initialize(req).zcql().executeZCQLQuery(v.query);
    const grid = orderBySelect(flattenZcql(result), v.query);
    const truncated = grid.rows.length > MAX_ROWS;
    res.json({ ...grid, rows: grid.rows.slice(0, MAX_ROWS), truncated, ms: Date.now() - started });
  } catch (e) {
    res.status(400).json({ error: errorText(e) });
  }
});

app.post('/check', (req, res) => {
  const { stage, name } = req.body || {};
  const r = checkAnswer(stage, name);
  res.status(r.ok ? 200 : 400).json(r);
});

// ---------- admin (seeding) ----------
function requireAdmin(req, res, next) {
  const key = process.env.ADMIN_KEY;
  if (!key || key === 'change-me') {
    return res.status(503).json({ error: 'Set a real ADMIN_KEY environment variable on the zcql_api function first.' });
  }
  if (req.get('x-admin-key') !== key) return res.status(401).json({ error: 'Bad admin key.' });
  next();
}

app.get('/admin/status', requireAdmin, async (req, res) => {
  try { res.json(await seeder.status(catalyst.initialize(req))); } catch (e) { res.status(500).json({ error: errorText(e) }); }
});

app.post('/admin/reset', requireAdmin, async (req, res) => {
  try { res.json({ deleted: await seeder.resetAll(catalyst.initialize(req)) }); } catch (e) { res.status(500).json({ error: errorText(e) }); }
});

app.post('/admin/seed', requireAdmin, async (req, res) => {
  const table = req.body && req.body.table;
  if (!TABLE_NAMES.includes(table)) return res.status(400).json({ error: `table must be one of: ${TABLE_NAMES.join(', ')}` });
  try { res.json(await seeder.seedTable(catalyst.initialize(req), table)); } catch (e) { res.status(500).json({ error: errorText(e) }); }
});

module.exports = app;
