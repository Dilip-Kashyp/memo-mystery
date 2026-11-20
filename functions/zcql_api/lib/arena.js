'use strict';
const { TABLES } = require('./schema');

function question(id, prompt, sql, decoys, explanation) {
  const answer = sql.match(/'(?:[^']|'')*'|ORDER BY|GROUP BY|INNER JOIN|LEFT JOIN|[^\s]+/g);
  const names = [...sql.matchAll(/\b(?:FROM|JOIN)\s+(\w+)/gi)].map((m) => m[1]);
  return { id, prompt, sql, answer, decoys, explanation, tables: TABLES.filter((t) => names.includes(t.name)) };
}
function q(id, prompt, sql, decoys, explanation) { return question(id, prompt, sql, decoys, explanation); }
const CASES = [
  { id: "missing-badge", title: "The missing badge", story: "Memo lost his badge. Help him look through the meetup records.", questions: [
    q("badge-1", "Show me meetup names and dates in Hyderabad.", "SELECT event_name, event_date FROM Meetup_Events WHERE city = 'Hyderabad'", ["venue", "'Chennai'"], "WHERE keeps only the meetups in Hyderabad."),
    q("badge-2", "Show me names that start with Kavya.", "SELECT full_name FROM Persons WHERE full_name LIKE 'Kavya *'", ["'Ravi *'", "area"], "LIKE finds part of a name. The * fills in the rest."),
    q("badge-3", "Show me five badges from the check-in list.", "SELECT badge_type FROM Event_Checkins LIMIT 5", ["person_id", "3"], "LIMIT 5 shows just five records.")
  ] },
  { id: "getaway", title: "The getaway trail", story: "Memo spotted an auto. Help him find its ride record.", questions: [
    q("ride-1", "Show me the number plates of Auto rides.", "SELECT vehicle_number FROM Cab_Rides WHERE vehicle_type = 'Auto'", ["'Cab'", "pickup_location"], "WHERE keeps only Auto rides."),
    q("ride-2", "Show me three rides with their number plates and fares.", "SELECT vehicle_number, fare FROM Cab_Rides LIMIT 3", ["5", "pickup_location"], "Pick the plate and fare columns, then use LIMIT 3."),
    q("ride-3", "Show me the three most expensive rides: plate and fare.", "SELECT vehicle_number, fare FROM Cab_Rides ORDER BY fare DESC LIMIT 3", ["ASC", "5"], "DESC puts the biggest fares first. LIMIT 3 keeps three rides.")
  ] },
  { id: "hidden-commit", title: "The hidden commit", story: "Memo left a clue in a code message. Help him find it.", questions: [
    q("commit-1", "Show me code messages that mention memo.", "SELECT commit_message FROM Commit_Logs WHERE commit_message LIKE '*memo*'", ["'*badge*'", "repo_name"], "The * on each side finds memo anywhere in the message."),
    q("commit-2", "Show me five code messages and their times.", "SELECT commit_message, committed_at FROM Commit_Logs LIMIT 5", ["3", "repo_name"], "Select the message and time, then keep five records."),
    q("commit-3", "How many code changes are in the log?", "SELECT COUNT(ROWID) FROM Commit_Logs", ["SUM(ROWID)", "Persons"], "COUNT counts the records in a table.")
  ] },
  { id: "money-trail", title: "The money trail", story: "Memo found a payment note. Help him check the money records.", questions: [
    q("money-1", "Show me payment amounts and notes for ₹5,000 or more.", "SELECT amount, txn_note FROM UPI_Payments WHERE amount >= 5000", ["<=", "500"], "The >= sign means that amount or more."),
    q("money-2", "Show me the five biggest payment amounts.", "SELECT amount FROM UPI_Payments ORDER BY amount DESC LIMIT 5", ["ASC", "3"], "DESC puts the biggest amounts first. LIMIT 5 keeps five."),
    q("money-3", "Show me payment amounts and dates for 15 November.", "SELECT amount, txn_date FROM UPI_Payments WHERE txn_date = '2026-11-15'", ["'2026-11-08'", "payer_id"], "Use WHERE to match one date. Dates go in single quotes.")
  ] },
  { id: "witness-notes", title: "The witness notebook", story: "Memo mixed up his notes. Help him find the right page.", questions: [
    q("witness-1", "Show me names and streets for people on Kondapur Main Road.", "SELECT full_name, address_street FROM Persons WHERE address_street = 'Kondapur Main Road'", ["area", "'Kondapur'"], "Match the full street name in address_street."),
    q("witness-2", "Show me three witness statements.", "SELECT transcript FROM Witness_Statements LIMIT 3", ["person_id", "5"], "The transcript column holds what the witness said."),
    q("witness-3", "Show me statements from 15 November.", "SELECT transcript FROM Witness_Statements WHERE statement_date = '2026-11-15'", ["'2026-11-08'", "person_id"], "Use statement_date to find notes from that day.")
  ] },
  { id: "late-exit", title: "The late exit", story: "Someone left while Memo looked away. Check the door records.", questions: [
    q("exit-1", "Show me speaker IDs and the times they left.", "SELECT person_id, checkout_time FROM Event_Checkins WHERE badge_type = 'Speaker'", ["'Volunteer'", "checkin_time"], "checkout_time means the time someone left. Keep Speaker badges."),
    q("exit-2", "Show me the three latest departures: person ID and exit time.", "SELECT person_id, checkout_time FROM Event_Checkins ORDER BY checkout_time DESC LIMIT 3", ["ASC", "5"], "DESC puts the latest exit times first."),
    q("exit-3", "Show me five exit times.", "SELECT checkout_time FROM Event_Checkins LIMIT 5", ["checkin_time", "3"], "Choose checkout_time and keep five records.")
  ] },
  { id: "meetup-map", title: "The meetup map", story: "Memo forgot where the meetups were. Help him check his map.", questions: [
    q("map-1", "Show me meetup names and venues for 15 November.", "SELECT event_name, venue FROM Meetup_Events WHERE event_date = '2026-11-15'", ["city", "'2026-11-08'"], "venue is the place where a meetup happened."),
    q("map-2", "Show me meetup names that start with ReactHyderabad.", "SELECT event_name FROM Meetup_Events WHERE event_name LIKE 'ReactHyderabad*'", ["'Workshop*'", "venue"], "The * matches the rest of the meetup name."),
    q("map-3", "Show me meetup names and dates, oldest first.", "SELECT event_name, event_date FROM Meetup_Events ORDER BY event_date ASC", ["DESC", "venue"], "ASC puts earlier dates first.")
  ] },
  { id: "volunteer", title: "The volunteer’s clue", story: "A volunteer left Memo a clue. Help him find their record.", questions: [
    q("volunteer-1", "Show me volunteer IDs and arrival times.", "SELECT person_id, checkin_time FROM Event_Checkins WHERE badge_type = 'Volunteer'", ["'Organizer'", "checkout_time"], "checkin_time means arrival time. Keep Volunteer badges."),
    q("volunteer-2", "Show me names and areas for people named Rao.", "SELECT full_name, area FROM Persons WHERE full_name LIKE '*Rao'", ["'*Reddy'", "company"], "The * matches any letters before Rao."),
    q("volunteer-3", "Show me five people: their names and areas.", "SELECT full_name, area FROM Persons LIMIT 5", ["company", "3"], "Choose full_name and area, then keep five records.")
  ] },
  { id: "report-room", title: "The report room", story: "Memo found a stack of police reports. Help him pick a page.", questions: [
    q("report-1", "Show me the dates and details of kidnapping reports.", "SELECT incident_date, details FROM Incident_Reports WHERE incident_type = 'kidnapping'", ["'theft'", "city"], "WHERE keeps only reports about kidnapping."),
    q("report-2", "Show me report details from Hyderabad.", "SELECT details FROM Incident_Reports WHERE city = 'Hyderabad'", ["'Chennai'", "incident_date"], "Filter the city to Hyderabad."),
    q("report-3", "Show me the three newest reports: date and details.", "SELECT incident_date, details FROM Incident_Reports ORDER BY incident_date DESC LIMIT 3", ["ASC", "5"], "DESC puts the newest dates first. Keep three records.")
  ] },
  { id: "organizer", title: "The organizer’s secret", story: "Who helped run the meetups? Memo wants to know.", questions: [
    q("organizer-1", "Show me event IDs and person IDs for organizers.", "SELECT event_id, person_id FROM Event_Checkins WHERE badge_type = 'Organizer'", ["'Speaker'", "checkout_time"], "WHERE keeps check-ins with an Organizer badge."),
    q("organizer-2", "Show me three person IDs from the check-in list.", "SELECT person_id FROM Event_Checkins LIMIT 3", ["event_id", "5"], "Choose person_id, then keep three records."),
    q("organizer-3", "How many people are in the people table?", "SELECT COUNT(ROWID) FROM Persons", ["SUM(ROWID)", "Meetup_Events"], "COUNT counts one record for each person.")
  ] },
];
function normalize(sql) {
  return (sql.match(/'(?:[^']|'')*'|[^\s]+/g) || []).map((token) => token[0] === "'" ? token : token.toUpperCase()).join(' ').replace(/;$/, '');
}
function grade(id, sql) {
  const item = CASES.flatMap((c) => c.questions).find((item) => item.id === id);
  if (!item) return null;
  return { correct: normalize(sql) === normalize(item.sql), solution: item.sql, explanation: item.explanation };
}
function publicCases() {
  return CASES.map((c) => ({ id: c.id, title: c.title, story: c.story, questions: c.questions.map((item) => ({
    id: item.id, prompt: item.prompt,
    tiles: [...item.answer, ...item.decoys].map((text, i) => ({ id: item.id + '-' + i, text })),
    tables: item.tables.map((t) => ({ ...t, columns: [{ name: 'ROWID', type: 'BigInt' }, ...t.columns] }))
  })) }));
}
module.exports = { CASES, grade, publicCases };
