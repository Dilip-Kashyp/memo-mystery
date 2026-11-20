'use strict';
/**
 * Single source of truth for the game's Catalyst Data Store tables.
 * Used by: the seeder (Catalyst), the local simulator (SQLite), and the
 * schema explorer in the web client (served via GET /schema).
 *
 * Every Catalyst table also gets the system columns ROWID, CREATORID,
 * CREATEDTIME and MODIFIEDTIME automatically — they are not listed here.
 *
 * `fk.from` / `fk.by`: seed rows reference parents by a natural key
 * (e.g. a person's full_name); the seeder swaps it for the parent's ROWID.
 */
const TABLES = [
  {
    name: 'Persons',
    about: 'Everyone in the Hyderabad tech scene who shows up in this case.',
    columns: [
      { name: 'full_name', type: 'VarChar', len: 100, unique: true },
      { name: 'address_number', type: 'Int' },
      { name: 'address_street', type: 'VarChar', len: 100 },
      { name: 'area', type: 'VarChar', len: 60 },
      { name: 'company', type: 'VarChar', len: 100 },
      { name: 'github_handle', type: 'VarChar', len: 60 },
    ],
  },
  {
    name: 'Meetup_Events',
    about: 'Tech meetups and workshops held around the city.',
    columns: [
      { name: 'event_name', type: 'VarChar', len: 120, unique: true },
      { name: 'event_date', type: 'Date' },
      { name: 'venue', type: 'VarChar', len: 120 },
      { name: 'city', type: 'VarChar', len: 60 },
    ],
  },
  {
    name: 'Incident_Reports',
    about: 'Police incident reports filed across South India.',
    columns: [
      { name: 'incident_date', type: 'Date' },
      { name: 'city', type: 'VarChar', len: 60 },
      { name: 'incident_type', type: 'VarChar', len: 60 },
      { name: 'details', type: 'Text' },
    ],
  },
  {
    name: 'Event_Checkins',
    about: 'Badge scans at the door of every meetup.',
    columns: [
      { name: 'event_id', type: 'Foreign Key', fk: { table: 'Meetup_Events', from: 'event', by: 'event_name' } },
      { name: 'person_id', type: 'Foreign Key', fk: { table: 'Persons', from: 'person', by: 'full_name' } },
      { name: 'badge_type', type: 'VarChar', len: 30 },
      { name: 'checkin_time', type: 'DateTime' },
      { name: 'checkout_time', type: 'DateTime' },
    ],
  },
  {
    name: 'Witness_Statements',
    about: 'Statements recorded by the investigating officers.',
    columns: [
      { name: 'person_id', type: 'Foreign Key', fk: { table: 'Persons', from: 'person', by: 'full_name' } },
      { name: 'statement_date', type: 'Date' },
      { name: 'transcript', type: 'Text' },
    ],
  },
  {
    name: 'Cab_Rides',
    about: 'Ride-hailing trips (autos, bikes and cabs) booked in the city.',
    columns: [
      { name: 'person_id', type: 'Foreign Key', fk: { table: 'Persons', from: 'person', by: 'full_name' } },
      { name: 'ride_date', type: 'Date' },
      { name: 'pickup_location', type: 'VarChar', len: 120 },
      { name: 'drop_location', type: 'VarChar', len: 120 },
      { name: 'vehicle_type', type: 'VarChar', len: 30 },
      { name: 'vehicle_number', type: 'VarChar', len: 20 },
      { name: 'fare', type: 'Double' },
    ],
  },
  {
    name: 'Commit_Logs',
    about: 'Git commits pushed over public Wi-Fi at meetup venues.',
    columns: [
      { name: 'person_id', type: 'Foreign Key', fk: { table: 'Persons', from: 'person', by: 'full_name' } },
      { name: 'repo_name', type: 'VarChar', len: 120 },
      { name: 'commit_message', type: 'VarChar', len: 255 },
      { name: 'committed_at', type: 'DateTime' },
    ],
  },
  {
    name: 'UPI_Payments',
    about: 'UPI transfers between people (obtained with a warrant).',
    columns: [
      { name: 'payer_id', type: 'Foreign Key', fk: { table: 'Persons', from: 'payer', by: 'full_name' } },
      { name: 'payee_id', type: 'Foreign Key', fk: { table: 'Persons', from: 'payee', by: 'full_name' } },
      { name: 'amount', type: 'Double' },
      { name: 'txn_note', type: 'VarChar', len: 120 },
      { name: 'txn_date', type: 'Date' },
    ],
  },
];

const SYSTEM_COLUMNS = [
  { name: 'ROWID', type: 'BigInt', system: true },
  { name: 'CREATORID', type: 'BigInt', system: true },
  { name: 'CREATEDTIME', type: 'DateTime', system: true },
  { name: 'MODIFIEDTIME', type: 'DateTime', system: true },
];

const TABLE_NAMES = TABLES.map((t) => t.name);

module.exports = { TABLES, SYSTEM_COLUMNS, TABLE_NAMES };
