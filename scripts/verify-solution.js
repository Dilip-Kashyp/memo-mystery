#!/usr/bin/env node
'use strict';
/**
 * Plays the whole case against the local simulator using ZCQL-legal queries
 * and asserts the clues lead to exactly one kidnapper and one mastermind.
 * Doubles as the official walkthrough for game hosts (keep it away from players!).
 */
process.removeAllListeners('warning');
const { run } = require('../dev/sim');
const { checkAnswer } = require('../functions/zcql_api/lib/game');
const { validateQuery } = require('../functions/zcql_api/lib/guard');

let step = 0;
function q(label, sql) {
  const v = validateQuery(sql);
  if (!v.ok) throw new Error(`Guard rejected step "${label}": ${v.error}`);
  const r = run(v.query);
  console.log(`\n#${++step} ${label}\n  ${sql.replace(/\s+/g, ' ')}\n  -> ${r.rows.length} row(s)`);
  r.rows.slice(0, 8).forEach((row) => console.log('     ', row.map((x) => (String(x).length > 70 ? String(x).slice(0, 67) + '...' : x)).join(' | ')));
  return r;
}
function expect(cond, msg) { if (!cond) { console.error('\n✗ FAILED:', msg); process.exit(1); } }
const col = (r, name) => r.rows.map((row) => row[r.columns.indexOf(name)]);

// 1. The crime scene report
let r = q('Incident report', "SELECT details FROM Incident_Reports WHERE incident_date = '2026-11-15' AND city = 'Hyderabad' AND incident_type = 'kidnapping'");
expect(r.rows.length === 1, 'exactly one kidnapping report');

// 2. Find the meetup
r = q('Meetup #42 ROWID', "SELECT ROWID, event_name FROM Meetup_Events WHERE event_name LIKE '*#42'");
expect(r.rows.length === 1, 'one meetup #42');
const m42 = r.rows[0][0];

// 3. Witness 1: first volunteer check-in at #42
r = q('First volunteer at #42', `SELECT Persons.ROWID, Persons.full_name, Event_Checkins.checkin_time FROM Event_Checkins INNER JOIN Persons ON Event_Checkins.person_id = Persons.ROWID WHERE Event_Checkins.event_id = ${m42} AND Event_Checkins.badge_type = 'Volunteer' ORDER BY Event_Checkins.checkin_time ASC LIMIT 1`);
expect(r.rows[0][1] === 'Ravi Teja Goud', 'Ravi is the first volunteer');

// 4. Witness 2: Kavya on Kondapur Main Road
r = q('Kavya on Kondapur Main Road', "SELECT ROWID, full_name, address_street FROM Persons WHERE full_name LIKE 'Kavya *' AND address_street = 'Kondapur Main Road'");
expect(r.rows.length === 1 && r.rows[0][1] === 'Kavya Sharma', 'one Kavya on Kondapur Main Road');

// 5. Their statements
r = q('Witness statements', "SELECT Persons.full_name, Witness_Statements.transcript FROM Witness_Statements INNER JOIN Persons ON Witness_Statements.person_id = Persons.ROWID WHERE Persons.full_name IN ('Ravi Teja Goud', 'Kavya Sharma')");
expect(r.rows.length === 2, 'two statements');

// 6. Speakers at #42 who left around 8:45 PM
r = q('Speakers leaving #42 between 20:30 and 21:00', `SELECT Persons.full_name, Event_Checkins.checkout_time FROM Event_Checkins INNER JOIN Persons ON Event_Checkins.person_id = Persons.ROWID WHERE Event_Checkins.event_id = ${m42} AND Event_Checkins.badge_type = 'Speaker' AND Event_Checkins.checkout_time >= '2026-11-15 20:30:00' AND Event_Checkins.checkout_time <= '2026-11-15 21:00:00'`);
const speakers = new Set(col(r, 'Persons.full_name'));
expect(speakers.size === 3, 'three speakers left in the window');

// 7. Autos that night with a TS09…7 plate
r = q('Autos with plate TS09*7 that night', "SELECT Persons.full_name, Cab_Rides.vehicle_number, Cab_Rides.pickup_location FROM Cab_Rides INNER JOIN Persons ON Cab_Rides.person_id = Persons.ROWID WHERE Cab_Rides.ride_date = '2026-11-15' AND Cab_Rides.vehicle_type = 'Auto' AND Cab_Rides.vehicle_number LIKE 'TS09*7'");
const autos = new Set(col(r, 'Persons.full_name'));

// 8. Workshop attendees who committed something about memo that day
r = q("Commits mentioning 'memo' during the workshop", "SELECT Persons.full_name, Commit_Logs.commit_message FROM Commit_Logs INNER JOIN Persons ON Commit_Logs.person_id = Persons.ROWID WHERE Commit_Logs.commit_message LIKE '*memo*' AND Commit_Logs.committed_at >= '2026-11-08 00:00:00' AND Commit_Logs.committed_at <= '2026-11-08 23:59:59'");
const committers = new Set(col(r, 'Persons.full_name'));

const kidnapper = [...speakers].filter((n) => autos.has(n) && committers.has(n));
console.log('\n  speakers ∩ autos ∩ memo-committers =', kidnapper);
expect(kidnapper.length === 1, 'exactly one kidnapper');
expect([...speakers].filter((n) => autos.has(n)).length === 1, 'speaker + auto alone is already unique');
expect(checkAnswer('kidnapper', kidnapper[0]).correct, 'server accepts the kidnapper');

// Stage 2: the mastermind
r = q("Kidnapper's statement + ROWID", `SELECT Persons.ROWID, Witness_Statements.transcript FROM Witness_Statements INNER JOIN Persons ON Witness_Statements.person_id = Persons.ROWID WHERE Persons.full_name = '${kidnapper[0]}'`);
const vid = r.rows[0][0];

r = q('Who paid the kidnapper in November?', `SELECT payer_id, SUM(amount), COUNT(ROWID) FROM UPI_Payments WHERE payee_id = ${vid} AND txn_date >= '2026-11-01' AND txn_date <= '2026-11-30' GROUP BY payer_id`);
const payers21k = r.rows.filter((row) => row[1] === 21000).map((row) => row[0]);
expect(payers21k.length === 2, 'two November payers total exactly 21000 (one is a red herring)');

r = q('ReactHyderabad meetups since September', "SELECT ROWID, event_name FROM Meetup_Events WHERE event_name LIKE 'ReactHyderabad*' AND event_date >= '2026-09-01'");
const series = r.rows.map((row) => row[0]);
expect(series.length === 3, 'three ReactHyderabad meetups');

r = q('Organizers at all of them', `SELECT Persons.ROWID, Persons.full_name, COUNT(Event_Checkins.ROWID) FROM Event_Checkins INNER JOIN Persons ON Event_Checkins.person_id = Persons.ROWID WHERE Event_Checkins.badge_type = 'Organizer' AND Event_Checkins.event_id IN (${series.join(', ')}) GROUP BY Persons.ROWID, Persons.full_name`);
const everyTime = r.rows.filter((row) => row[2] === series.length);
const mastermind = everyTime.filter((row) => payers21k.map(String).includes(String(row[0])));
console.log('\n  organizer-at-every-meetup ∩ paid ₹21,000 in November =', mastermind.map((m) => m[1]));
expect(mastermind.length === 1, 'exactly one mastermind');
expect(checkAnswer('mastermind', mastermind[0][1]).correct, 'server accepts the mastermind');

// Rule checks the simulator should enforce
const shouldFail = [
  ["SELECT * FROM Persons JOIN Event_Checkins ON Persons.full_name = Event_Checkins.badge_type", 'join on non-FK'],
  ["SELECT * FROM Persons WHERE ROWID > 1 AND ROWID > 2 AND ROWID > 3 AND ROWID > 4 AND ROWID > 5 AND ROWID > 6", '6 WHERE conditions'],
];
for (const [sql, why] of shouldFail) {
  let threw = false; try { run(sql); } catch { threw = true; }
  expect(threw, `simulator should reject: ${why}`);
}
for (const bad of ['DELETE FROM Persons', 'SELECT * FROM Persons; DROP TABLE Persons', 'SELECT * FROM SecretTable', "SELECT * FROM Persons WHERE full_name = 'x' -- hi"]) {
  expect(!validateQuery(bad).ok, `guard should reject: ${bad}`);
}
expect(validateQuery("SELECT * FROM Witness_Statements WHERE transcript LIKE '*delete from*'").ok, 'keywords inside strings are fine');
// Percent is literal in ZCQL LIKE, so % searches find nothing
expect(run("SELECT full_name FROM Persons WHERE full_name LIKE 'Kavya%'").rows.length === 0, '% is not a wildcard');

console.log('\n✓ Case verified: one kidnapper, one mastermind, ZCQL rules enforced.');
