#!/usr/bin/env node
'use strict';
// Host-only verification: guided paths and decoys against the real local simulator.
process.removeAllListeners('warning');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { run } = require('../dev/sim');
const { validateQuery } = require('../functions/zcql_api/lib/guard');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../client/guided.js'), 'utf8'), context);
const missions = context.window.MEMO_MISSIONS;
const expectedCounts = [1, 1, 1, 2, 3, 2, 3, 1, 4, 4];
const expand = (sql) => sql.replaceAll('{{kidnapper}}', 'Vikram Chowdary');
let decoys = 0;
for (const [index, mission] of missions.entries()) {
  const pieces = mission.parts.map((part) => part.answer);
  const sql = expand(pieces.join('\n'));
  assert.ok(validateQuery(sql).ok, mission.title + ': query must pass the guard');
  const result = run(sql);
  assert.equal(result.rows.length, expectedCounts[index], mission.title);
  for (const [partIndex, part] of mission.parts.entries()) {
    assert.equal(new Set(part.options).size, 3, mission.title + ': three distinct choices');
    assert.ok(part.options.includes(part.answer));
    for (const option of part.options.filter((value) => value !== part.answer)) {
      const candidate = pieces.slice();
      candidate[partIndex] = option;
      const query = expand(candidate.join('\n'));
      assert.ok(validateQuery(query).ok, 'Decoys must remain read-only game queries');
      let alternative;
      try { alternative = run(query); } catch { decoys++; continue; }
      assert.notEqual(JSON.stringify(alternative), JSON.stringify(result), mission.title + ': decoy should change the evidence');
      decoys++;
    }
  }
  console.log('✓ ' + mission.title);
}
assert.equal(missions.length, expectedCounts.length);
console.log('✓ ' + missions.length + ' guided leads and ' + decoys + ' decoys verified.');
