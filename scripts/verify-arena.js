#!/usr/bin/env node
'use strict';
process.removeAllListeners('warning');
const assert = require('node:assert/strict');
const { CASES, grade, publicCases } = require('../functions/zcql_api/lib/arena');
const { validateQuery } = require('../functions/zcql_api/lib/guard');
const { run } = require('../dev/sim');
const publicBank = publicCases();
assert.equal(CASES.length, 10);
const all = CASES.flatMap((c) => c.questions);
assert.equal(all.length, 30);
assert.equal(new Set(all.map((q) => q.id)).size, 30);
assert.equal(new Set(all.map((q) => q.sql)).size, 30);
for (const c of CASES) {
  assert.equal(c.questions.length, 3);
  for (const q of c.questions) {
    const v = validateQuery(q.sql);
    assert.ok(v.ok, q.id + ': guard');
    assert.ok(run(q.sql).rows.length, q.id + ': must return evidence');
    assert.equal(q.answer.join(' '), q.sql, q.id + ': tiles assemble the query');
    assert.ok(grade(q.id, q.answer.join(' ')).correct, q.id + ': right query accepted');
    assert.ok(!grade(q.id, 'SELECT').correct, q.id + ': incomplete query rejected');
    assert.ok(!grade(q.id, q.answer.slice().reverse().join(' ')).correct, q.id + ': wrong order rejected');
    const p = publicBank.find((item) => item.id === c.id).questions.find((item) => item.id === q.id);
    assert.ok(!p.sql && !p.answer && !p.solution, 'Do not expose the solution in the challenge response');
    assert.equal(q.decoys.length, 2, 'Two decoys keep choices manageable');
    assert.equal(p.tiles.length, q.answer.length + q.decoys.length);
    assert.ok(q.answer.length <= 10, q.id + ': keep each query short');
    assert.ok(!/\b(?:JOIN|GROUP BY|AND|OR)\b/.test(q.sql), q.id + ': one simple task per question');
    assert.equal(p.tiles.length, q.answer.length + q.decoys.length);
    assert.equal(new Set(p.tiles.map((t) => t.id)).size, p.tiles.length);
    assert.deepEqual(p.tables.map((t) => t.name), q.tables.map((t) => t.name));
    for (const t of p.tables) assert.ok(t.columns.some((col) => col.name === 'ROWID'));
    for (const decoy of q.decoys) assert.ok(!grade(q.id, q.sql + ' ' + decoy).correct);
  }
}
assert.equal(grade('missing-question', 'SELECT * FROM Persons'), null);
console.log('✓ 10 cases, 30 short queries, 60 decoys, tile assembly, grading, and scoped schemas verified.');
