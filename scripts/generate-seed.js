#!/usr/bin/env node
'use strict';
/**
 * Generates functions/zcql_api/data/seed-data.json.
 * Story rows are hand-written; filler rows come from a seeded PRNG, so the
 * output is identical on every run. Run `node scripts/verify-solution.js`
 * after any change to make sure the case still has exactly one solution.
 */
const fs = require('fs');
const path = require('path');

// ---------- deterministic PRNG ----------
let seed = 20261115;
function rand() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (a) => a[Math.floor(rand() * a.length)];
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pad = (n, w = 2) => String(n).padStart(w, '0');
const time = (h, m, s) => `${pad(h)}:${pad(m)}:${pad(s)}`;
function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// ---------- reference data ----------
const STREETS = [
  ['Madhapur', 'Madhapur Main Road'], ['Madhapur', 'Ayyappa Society Road'],
  ['Kondapur', 'Kondapur Main Road'], ['Kondapur', 'Kondapur Cross Road'],
  ['Gachibowli', 'Gachibowli Main Road'], ['Gachibowli', 'Indira Nagar Road'],
  ['Jubilee Hills', 'Road No. 36'], ['Banjara Hills', 'Road No. 12'],
  ['Kukatpally', 'KPHB Road'], ['Manikonda', 'Puppalaguda Road'],
  ['Miyapur', 'Allwyn Colony Road'], ['Begumpet', 'Prakash Nagar Road'],
  ['Ameerpet', 'Mythrivanam Road'], ['Secunderabad', 'SD Road'], ['Tolichowki', 'Seven Tombs Road'],
];
const COMPANIES = [
  'Biryani Labs', 'Charminar Cloud', 'Pixel Pearl Studios', 'Deccan Devworks', 'Irani Chai Systems',
  'Golconda Data', 'Nizam Networks', 'Lassi Logic', 'Hussain Sagar Tech', 'Minar Mobile',
  'Osmania Analytics', 'Haleem Health', 'Pearl City Payments', 'Rock Garden Robotics', 'Freelancer',
];
const FIRST = [
  'Aarav', 'Aditya', 'Akhil', 'Ananya', 'Anil', 'Anusha', 'Bhavana', 'Chaitanya', 'Deepika', 'Dinesh',
  'Gautam', 'Harika', 'Harsha', 'Ishaan', 'Jahnavi', 'Karthik', 'Keerthi', 'Lohith', 'Mahesh', 'Mounika',
  'Nikhil', 'Nithya', 'Pavan', 'Prasad', 'Pranav', 'Rahul', 'Rajesh', 'Ramya', 'Rohit', 'Sai',
  'Sandeep', 'Shravya', 'Siddharth', 'Sindhu', 'Srikanth', 'Swathi', 'Tarun', 'Tejaswini', 'Uday', 'Varun',
  'Vamsi', 'Yamini', 'Zoya', 'Imran', 'Sana', 'Ayesha', 'Joseph', 'Neha', 'Abhishek', 'Bindu',
];
const LAST = [
  'Reddy', 'Rao', 'Naidu', 'Sharma', 'Varma', 'Goud', 'Iyer', 'Menon', 'Patel', 'Khan',
  'Choudhary', 'Bhat', 'Joshi', 'Kulkarni', 'Pillai', 'Sinha', 'Desai', 'Agarwal', 'Thomas', 'Shaik',
];
const PLACES = [
  'Raidurg Innovation Hub', 'Hitech City Co-work Hub', 'Madhapur', 'Kondapur', 'Gachibowli', 'Kukatpally',
  'Ameerpet', 'Begumpet', 'Secunderabad Station', 'Airport', 'Jubilee Hills', 'Banjara Hills', 'Tolichowki',
  'Miyapur', 'Manikonda', 'Inorbit Mall',
];
const COMMIT_MSGS = [
  'fix: off-by-one in pagination', 'feat: add dark mode toggle', 'chore: bump dependencies',
  'refactor: extract useDebounce hook', 'test: add snapshot for Navbar', 'fix: hydration mismatch on footer',
  'docs: update README setup steps', 'feat: lazy-load the dashboard route', 'fix: stale closure in useEffect',
  'perf: virtualize the long list', 'chore: remove console.logs before demo', 'feat: add Telugu translations',
  'fix: CORS on staging API', 'refactor: move state to context', 'feat: biryani order tracker MVP',
  'fix: typo in error message', 'ci: cache node_modules', 'feat: add suspense boundary', 'style: run prettier',
  'wip: please work', 'fix: useCallback deps warning', 'feat: add skeleton loaders',
];
const PAY_NOTES = ['chai', 'biryani split', 'rent share', 'cab split', 'conference ticket', 'book', 'birthday gift', 'groceries', 'movie tickets', 'laptop sticker pack'];

// ---------- the cast (story-critical people) ----------
const CAST = [
  // name, number, street, area, company, github
  ['Ravi Teja Goud', 14, 'Madhapur Main Road', 'Madhapur', 'Deccan Devworks', 'raviteja-codes'],
  ['Kavya Sharma', 221, 'Kondapur Main Road', 'Kondapur', 'Pixel Pearl Studios', 'kavya-s'],
  ['Kavya Reddy', 37, 'Madhapur Main Road', 'Madhapur', 'Biryani Labs', 'kavyareddy'],
  ['Kavya Nair', 88, 'Kondapur Cross Road', 'Kondapur', 'Lassi Logic', 'kavyanair-dev'],
  ['Kavyasri Rao', 9, 'Allwyn Colony Road', 'Miyapur', 'Golconda Data', 'kavyasri'],
  ['Vikram Chowdary', 402, 'Seven Tombs Road', 'Tolichowki', 'Freelancer', 'vikram-builds'],
  ['Arjun Mehta', 56, 'Road No. 36', 'Jubilee Hills', 'Charminar Cloud', 'arjunm'],
  ['Farhan Ali', 12, 'Seven Tombs Road', 'Tolichowki', 'Nizam Networks', 'farhan-js'],
  ['Sneha Iyer', 73, 'Gachibowli Main Road', 'Gachibowli', 'Hussain Sagar Tech', 'snehaiyer'],
  ['Meghana Rao', 145, 'Prakash Nagar Road', 'Begumpet', 'Minar Mobile', 'meghana-r'],
  ['Pooja Saxena', 61, 'Indira Nagar Road', 'Gachibowli', 'Osmania Analytics', 'poojasaxena'],
  ['Rhea Kapoor', 310, 'Kondapur Main Road', 'Kondapur', 'Pearl City Payments', 'rhea-k'],
  ['Manoj Varma', 18, 'KPHB Road', 'Kukatpally', 'Irani Chai Systems', 'manojvarma'],
  ['Lakshmi Prasanna', 27, 'Mythrivanam Road', 'Ameerpet', 'Golconda Data', 'lakshmi-p'],
  ['Kiran Kumar', 5, 'Puppalaguda Road', 'Manikonda', 'Haleem Health', 'kirankumar'],
  ['Divya Menon', 90, 'Road No. 12', 'Banjara Hills', 'Rock Garden Robotics', 'divyamenon'],
  ['Naveen Kumar', 33, 'SD Road', 'Secunderabad', 'Nizam Networks', 'naveenk'],
  ['Harsha Vardhan', 71, 'Ayyappa Society Road', 'Madhapur', 'Deccan Devworks', 'harsha-v'],
];
const CAST_NAMES = new Set(CAST.map((c) => c[0]));

// ---------- tables ----------
const out = {
  Persons: [], Meetup_Events: [], Incident_Reports: [], Event_Checkins: [],
  Witness_Statements: [], Cab_Rides: [], Commit_Logs: [], UPI_Payments: [],
};

for (const [full_name, address_number, address_street, area, company, github_handle] of CAST) {
  out.Persons.push({ full_name, address_number, address_street, area, company, github_handle });
}

// Filler people: unique names, no first-name "Kavya*" (keeps the witness clue clean).
const used = new Set(CAST_NAMES);
const filler = [];
while (filler.length < 112) {
  const name = `${pick(FIRST)} ${pick(LAST)}`;
  if (used.has(name)) continue;
  used.add(name);
  const [area, street] = pick(STREETS);
  const p = {
    full_name: name, address_number: int(1, 480), address_street: street, area,
    company: pick(COMPANIES), github_handle: `${name.split(' ')[0].toLowerCase()}${int(1, 999)}`,
  };
  filler.push(p);
  out.Persons.push(p);
}
const F = filler.map((p) => p.full_name);

// ---------- events ----------
const EV = {
  m40: { event_name: 'ReactHyderabad Meetup #40', event_date: '2026-09-20', venue: 'Raidurg Innovation Hub', city: 'Hyderabad' },
  m41: { event_name: 'ReactHyderabad Meetup #41', event_date: '2026-10-18', venue: 'Raidurg Innovation Hub', city: 'Hyderabad' },
  ts: { event_name: 'TypeScript Tiffin Talks', event_date: '2026-10-25', venue: 'Hitech City Co-work Hub', city: 'Hyderabad' },
  next: { event_name: 'Next.js Night', event_date: '2026-11-01', venue: 'Gachibowli Stadium Lounge', city: 'Hyderabad' },
  hooks: { event_name: 'Hooks Deep Dive Workshop', event_date: '2026-11-08', venue: 'Hitech City Co-work Hub', city: 'Hyderabad' },
  m42: { event_name: 'ReactHyderabad Meetup #42', event_date: '2026-11-15', venue: 'Raidurg Innovation Hub', city: 'Hyderabad' },
  blr: { event_name: 'JSBengaluru Monthly', event_date: '2026-11-15', venue: 'Koramangala Hall', city: 'Bengaluru' },
};
out.Meetup_Events.push(...Object.values(EV));

// ---------- check-ins ----------
function checkin(ev, person, badge_type, inT, outT) {
  const d = EV[ev].event_date;
  out.Event_Checkins.push({ event: EV[ev].event_name, person, badge_type, checkin_time: `${d} ${inT}`, checkout_time: `${d} ${outT}` });
}
// Organizers of the ReactHyderabad series
for (const ev of ['m40', 'm41', 'm42']) {
  checkin(ev, 'Rhea Kapoor', 'Organizer', time(15, int(10, 40), int(0, 59)), time(22, int(5, 30), int(0, 59)));
  checkin(ev, 'Manoj Varma', 'Organizer', time(15, int(10, 40), int(0, 59)), time(22, int(5, 30), int(0, 59)));
}
for (const ev of ['m40', 'm42']) checkin(ev, 'Lakshmi Prasanna', 'Organizer', time(15, int(30, 55), int(0, 59)), time(21, int(40, 59), int(0, 59)));
for (const ev of ['m40', 'm41']) checkin(ev, 'Sneha Iyer', 'Organizer', time(15, int(30, 55), int(0, 59)), time(21, int(40, 59), int(0, 59)));
for (const ev of ['m40', 'm41', 'm42']) checkin(ev, 'Kiran Kumar', 'Attendee', time(17, int(40, 59), int(0, 59)), time(21, int(0, 30), int(0, 59)));

// Meetup #42 — the night of the kidnapping
checkin('m42', 'Ravi Teja Goud', 'Volunteer', '16:05:12', '22:31:40');
checkin('m42', 'Arjun Mehta', 'Speaker', '17:20:03', '20:41:07');
checkin('m42', 'Vikram Chowdary', 'Speaker', '17:48:55', '20:46:31');
checkin('m42', 'Farhan Ali', 'Speaker', '17:31:18', '20:52:44');
checkin('m42', 'Sneha Iyer', 'Speaker', '17:05:40', '21:28:15');
checkin('m42', 'Meghana Rao', 'Speaker', '17:55:21', '21:40:02');
checkin('m42', 'Kavya Sharma', 'Attendee', '17:58:10', '21:15:33');
checkin('m42', 'Kavya Reddy', 'Attendee', '18:02:47', '20:05:19');
checkin('m42', 'Pooja Saxena', 'Attendee', '18:10:09', '20:49:51');
checkin('m42', 'Divya Menon', 'Attendee', '18:12:30', '21:05:00');
checkin('m42', 'Naveen Kumar', 'Volunteer', '16:21:44', '22:10:12');

// Hooks Deep Dive Workshop (2026-11-08)
checkin('hooks', 'Naveen Kumar', 'Volunteer', '08:50:31', '16:40:00');
checkin('hooks', 'Harsha Vardhan', 'Organizer', '08:30:02', '17:05:45');
checkin('hooks', 'Vikram Chowdary', 'Attendee', '09:41:16', '16:02:09');
checkin('hooks', 'Arjun Mehta', 'Speaker', '09:15:50', '16:30:27');
checkin('hooks', 'Kavya Sharma', 'Attendee', '09:38:04', '16:10:55');
checkin('hooks', 'Meghana Rao', 'Attendee', '09:52:13', '15:47:39');
checkin('hooks', 'Kavya Nair', 'Attendee', '09:59:59', '13:00:12');

// Other events: a few cast cameos
checkin('m40', 'Vikram Chowdary', 'Attendee', '17:51:00', '21:02:10');
checkin('m41', 'Arjun Mehta', 'Speaker', '17:15:22', '21:10:44');
checkin('m41', 'Farhan Ali', 'Attendee', '18:01:37', '20:58:03');
checkin('next', 'Farhan Ali', 'Speaker', '18:10:00', '21:20:00');
checkin('next', 'Rhea Kapoor', 'Attendee', '18:30:41', '20:15:09');
checkin('ts', 'Ravi Teja Goud', 'Attendee', '10:02:00', '13:30:00');
checkin('blr', 'Kavyasri Rao', 'Speaker', '17:30:00', '21:00:00');

// Filler attendees / volunteers / speakers for every event
const EVENT_SHAPE = {
  m40: { start: 17, n: 30 }, m41: { start: 17, n: 30 }, m42: { start: 17, n: 34 },
  ts: { start: 9, n: 20 }, next: { start: 18, n: 26 }, hooks: { start: 9, n: 20 }, blr: { start: 17, n: 18 },
};
for (const [ev, { start, n }] of Object.entries(EVENT_SHAPE)) {
  const people = shuffle(F).slice(0, n + 4);
  people.slice(0, n).forEach((p) => {
    const inT = time(start, int(30, 59), int(0, 59));
    const outT = time(start + int(2, 4), int(0, 59), int(0, 59));
    checkin(ev, p, 'Attendee', inT, outT);
  });
  // two filler volunteers (always after Ravi's 16:05 on #42)
  people.slice(n, n + 2).forEach((p) => {
    const inT = ev === 'm42' ? time(16, int(25, 59), int(0, 59)) : time(start - 1, int(10, 59), int(0, 59));
    checkin(ev, p, 'Volunteer', inT, time(start + 4, int(0, 59), int(0, 59)));
  });
  // filler speakers & organizers only for non-ReactHyderabad events (#42 speakers are fixed)
  if (!['m42', 'm40', 'm41'].includes(ev)) {
    checkin(ev, people[n + 2], 'Speaker', time(start, int(0, 20), int(0, 59)), time(start + 3, int(0, 59), int(0, 59)));
    if (ev !== 'hooks') checkin(ev, people[n + 3], 'Organizer', time(start - 1, int(0, 30), int(0, 59)), time(start + 4, int(0, 59), int(0, 59)));
  } else if (ev !== 'm42') {
    checkin(ev, people[n + 2], 'Speaker', time(start, int(0, 20), int(0, 59)), time(start + 3, int(0, 59), int(0, 59)));
  }
}

// ---------- incident reports ----------
out.Incident_Reports.push(
  { incident_date: '2026-11-15', city: 'Hyderabad', incident_type: 'kidnapping', details:
    "Around 20:45, Memo, the beloved mascot of ReactHyderabad, vanished from the stage at 'ReactHyderabad Meetup #42' right after the lightning talks. " +
    "Venue CCTV was useless: someone had memoized the camera feed, so it replayed the same frame for an hour. " +
    "Two witnesses came forward. The first is the person who checked in FIRST with a 'Volunteer' badge at that meetup. " +
    "The second is an attendee named Kavya who lives on 'Kondapur Main Road'." },
  { incident_date: '2026-11-15', city: 'Bengaluru', incident_type: 'kidnapping', details:
    "A rubber debugging duck was taken from a desk at JSBengaluru Monthly. It was later found in the pantry, debugging the coffee machine. Case closed." },
  { incident_date: '2026-11-15', city: 'Hyderabad', incident_type: 'theft', details:
    "Twelve plates of biryani disappeared from a wedding hall in Tolichowki. The suspects were last seen asking for extra raita." },
  { incident_date: '2026-11-14', city: 'Hyderabad', incident_type: 'kidnapping', details:
    "Report of a kidnapped cat in Ameerpet. The cat was found asleep inside a cardboard box from an online order. No further action." },
  { incident_date: '2026-11-16', city: 'Hyderabad', incident_type: 'vandalism', details:
    "Someone wrote 'console.log(\"was here\")' on a whiteboard at Hitech City Co-work Hub in permanent marker." },
  { incident_date: '2026-11-15', city: 'Chennai', incident_type: 'fraud', details:
    "A man sold 'lifetime premium' accounts to a free, open-source library outside a college fest." },
  { incident_date: '2026-11-08', city: 'Hyderabad', incident_type: 'noise complaint', details:
    "Neighbours of Hitech City Co-work Hub complained about loud cheering at the 'Hooks Deep Dive Workshop' after a demo finally worked." },
  { incident_date: '2026-11-01', city: 'Hyderabad', incident_type: 'theft', details:
    "Three HDMI adapters went missing at 'Next.js Night'. Organisers believe they were reabsorbed into attendees' backpacks." },
  { incident_date: '2026-10-18', city: 'Hyderabad', incident_type: 'lost property', details:
    "A laptop covered in React stickers was handed in at Raidurg Innovation Hub. The owner claimed it 47 seconds later." },
  { incident_date: '2026-11-15', city: 'Pune', incident_type: 'kidnapping', details:
    "A cardboard cut-out of a famous cricketer was taken from a mall in Pune. It was returned with an autograph that is probably fake." },
);
const TYPES = ['theft', 'vandalism', 'fraud', 'lost property', 'noise complaint', 'traffic'];
const CITIES = ['Hyderabad', 'Bengaluru', 'Chennai', 'Pune', 'Vijayawada', 'Visakhapatnam'];
const BLURBS = [
  'Two-wheeler parked on the footpath for three days. Owner traced via number plate.',
  'Shopkeeper reports counterfeit currency used for a pack of samosas.',
  'Mobile phone snatched near a bus stop. CCTV footage under review.',
  'Dispute over a cricket ball that broke a window. Settled amicably.',
  'Office projector reported missing. Found in a meeting room nobody books.',
  'Fake job offer emails sent to students. Cyber cell notified.',
  'Loud music after midnight in a gated community. Warning issued.',
];
for (let i = 0; i < 26; i++) {
  const city = pick(CITIES);
  const day = int(1, 28);
  const month = pick(['09', '10', '11']);
  const d = `2026-${month}-${pad(day)}`;
  if (d === '2026-11-15' && city === 'Hyderabad') continue; // keep the key date clean
  out.Incident_Reports.push({ incident_date: d, city, incident_type: pick(TYPES), details: pick(BLURBS) });
}

// ---------- witness statements ----------
out.Witness_Statements.push(
  { person: 'Ravi Teja Goud', statement_date: '2026-11-15', transcript:
    "Around quarter to nine I was stacking chairs near the back exit when someone with a purple 'Speaker' badge hurried out holding a laptop bag that was... squeaking? " +
    "They jumped straight into an auto waiting outside. I only caught part of the number plate: it started with 'TS09' and ended with '7'." },
  { person: 'Kavya Sharma', statement_date: '2026-11-15', transcript:
    "I recognised that face! They were at the 'Hooks Deep Dive Workshop' the Sunday before. During the workshop they kept pushing commits on the venue Wi-Fi, " +
    "and I swear one commit message mentioned 'memo'. I thought it was a React thing. Now I'm not so sure." },
  { person: 'Kavya Reddy', statement_date: '2026-11-16', transcript:
    "I left Meetup #42 early, around 8 PM, to catch a movie. I didn't see anything, sorry. Memo always waved at me though. :(" },
  { person: 'Kavya Nair', statement_date: '2026-11-16', transcript:
    "Memo? Is that a hook? I wasn't at Meetup #42, I was debugging a production outage all evening." },
  { person: 'Naveen Kumar', statement_date: '2026-11-15', transcript:
    "I was on registration duty at the front door all night. Nobody left through the front with anything squeaky." },
  { person: 'Arjun Mehta', statement_date: '2026-11-16', transcript:
    "I left right after my talk, around 8:40. My wife picked me up on her scooter, we went for Irani chai. I love Memo, I'd never hurt him." },
  { person: 'Farhan Ali', statement_date: '2026-11-16', transcript:
    "Yes I left before nine, I booked a bike taxi home to Tolichowki. My talk ran long, I was hungry. That's the whole story." },
  { person: 'Rhea Kapoor', statement_date: '2026-11-16', transcript:
    "As an organizer I am devastated. I was busy with logistics the whole evening. Memo is the heart of this community. Whoever did this must be found." },
  { person: 'Vikram Chowdary', statement_date: '2026-11-17', transcript:
    "Okay, okay. I took Memo. But it wasn't my idea! Someone paid me over UPI: a few smaller transfers in November so nobody would notice, ₹21,000 in total. " +
    "I never saw their face. All I know is they told me they had been an Organizer at every single ReactHyderabad meetup since September, and that Memo 'deserved a bigger stage'." },
  { person: 'Divya Menon', statement_date: '2026-11-16', transcript:
    "I was in the biryani queue during the lightning talks. Priorities." },
  { person: 'Pooja Saxena', statement_date: '2026-11-16', transcript:
    "I took an auto home to Gachibowli just before nine. The only thing in my bag was a stack of stickers." },
);
for (const p of shuffle(F).slice(0, 8)) {
  out.Witness_Statements.push({ person: p, statement_date: `2026-${pick(['10', '11'])}-${pad(int(1, 14))}`, transcript: pick([
    'I saw nothing unusual. I was at home watching cricket.',
    'My phone was stolen near the bus stop. The thief was wearing a blue jacket.',
    'Someone parked a scooter in front of my gate again.',
    'I heard a loud argument about tabs versus spaces next door.',
  ]) });
}

// ---------- cab rides ----------
out.Cab_Rides.push(
  { person: 'Vikram Chowdary', ride_date: '2026-11-15', pickup_location: 'Raidurg Innovation Hub', drop_location: 'Kondapur', vehicle_type: 'Auto', vehicle_number: 'TS09UB4417', fare: 142 },
  { person: 'Farhan Ali', ride_date: '2026-11-15', pickup_location: 'Raidurg Innovation Hub', drop_location: 'Tolichowki', vehicle_type: 'Bike', vehicle_number: 'TS09EZ1207', fare: 96 },
  { person: 'Pooja Saxena', ride_date: '2026-11-15', pickup_location: 'Raidurg Innovation Hub', drop_location: 'Gachibowli', vehicle_type: 'Auto', vehicle_number: 'TS09AB3327', fare: 88 },
  { person: 'Kavya Reddy', ride_date: '2026-11-15', pickup_location: 'Raidurg Innovation Hub', drop_location: 'Inorbit Mall', vehicle_type: 'Cab', vehicle_number: 'TS09FA5512', fare: 120 },
  { person: 'Vikram Chowdary', ride_date: '2026-11-08', pickup_location: 'Tolichowki', drop_location: 'Hitech City Co-work Hub', vehicle_type: 'Auto', vehicle_number: 'TS13UC2208', fare: 165 },
  { person: 'Rhea Kapoor', ride_date: '2026-11-15', pickup_location: 'Raidurg Innovation Hub', drop_location: 'Kondapur', vehicle_type: 'Cab', vehicle_number: 'TS07GH9031', fare: 210 },
);
function plate() {
  const code = pick(['TS07', 'TS08', 'TS09', 'TS10', 'TS11', 'TS13']);
  const letters = String.fromCharCode(65 + int(0, 25)) + String.fromCharCode(65 + int(0, 25));
  let digits = pad(int(0, 9999), 4);
  if (code === 'TS09' && digits.endsWith('7')) digits = digits.slice(0, 3) + '3'; // only story plates match TS09*7
  return code + letters + digits;
}
for (let i = 0; i < 150; i++) {
  const onNight = i < 22;
  const pickup = onNight ? pick(['Raidurg Innovation Hub', ...PLACES]) : pick(PLACES);
  let drop = pick(PLACES);
  if (drop === pickup) drop = 'Ameerpet';
  out.Cab_Rides.push({
    person: pick(F), ride_date: onNight ? '2026-11-15' : `2026-${pick(['10', '11'])}-${pad(int(1, 28))}`,
    pickup_location: pickup, drop_location: drop, vehicle_type: pick(['Auto', 'Auto', 'Cab', 'Bike']),
    vehicle_number: plate(), fare: int(40, 480),
  });
}

// ---------- commit logs ----------
out.Commit_Logs.push(
  { person: 'Vikram Chowdary', repo_name: 'vikram-builds/side-quest', commit_message: 'feat: relocate memo to /home/kondapur (temporary, i promise)', committed_at: '2026-11-08 13:42:10' },
  { person: 'Vikram Chowdary', repo_name: 'vikram-builds/side-quest', commit_message: 'chore: buy a bigger laptop bag', committed_at: '2026-11-08 14:05:51' },
  { person: 'Arjun Mehta', repo_name: 'arjunm/hooks-workshop-demos', commit_message: 'docs: add React.memo vs useMemo examples', committed_at: '2026-11-08 11:15:00' },
  { person: 'Meghana Rao', repo_name: 'meghana-r/blog', commit_message: 'fix: typo in memoir component', committed_at: '2026-11-08 12:31:44' },
  { person: 'Lakshmi Prasanna', repo_name: 'golconda/dashboard', commit_message: 'refactor: memoize expensive selectors', committed_at: '2026-11-02 19:20:00' },
  { person: 'Rhea Kapoor', repo_name: 'rhea-k/react-secunderabad', commit_message: 'feat: landing page for a BIGGER meetup (mascot tbd)', committed_at: '2026-11-10 22:48:13' },
);
for (let i = 0; i < 140; i++) {
  const d = `2026-${pick(['10', '11'])}-${pad(int(1, 20))}`;
  const who = pick(F);
  out.Commit_Logs.push({
    person: who, repo_name: `${who.split(' ')[0].toLowerCase()}/${pick(['portfolio', 'todo-app', 'api', 'dashboard', 'side-project', 'dotfiles'])}`,
    commit_message: pick(COMMIT_MSGS), committed_at: `${d} ${time(int(8, 23), int(0, 59), int(0, 59))}`,
  });
}

// ---------- UPI payments ----------
out.UPI_Payments.push(
  // the real money trail: 3 transfers in November, ₹21,000 total
  { payer: 'Rhea Kapoor', payee: 'Vikram Chowdary', amount: 7000, txn_note: 'chai', txn_date: '2026-11-03' },
  { payer: 'Rhea Kapoor', payee: 'Vikram Chowdary', amount: 6500, txn_note: 'office supplies', txn_date: '2026-11-09' },
  { payer: 'Rhea Kapoor', payee: 'Vikram Chowdary', amount: 7500, txn_note: 'costume rental', txn_date: '2026-11-13' },
  // red herring 1: same total in November, but Kiran is never an Organizer
  { payer: 'Kiran Kumar', payee: 'Vikram Chowdary', amount: 6000, txn_note: 'rent share', txn_date: '2026-11-01' },
  { payer: 'Kiran Kumar', payee: 'Vikram Chowdary', amount: 5000, txn_note: 'rent share', txn_date: '2026-11-05' },
  { payer: 'Kiran Kumar', payee: 'Vikram Chowdary', amount: 4000, txn_note: 'rent share', txn_date: '2026-11-11' },
  { payer: 'Kiran Kumar', payee: 'Vikram Chowdary', amount: 6000, txn_note: 'rent share', txn_date: '2026-11-14' },
  // red herring 2: right total, but in October (and not organizer at #42)
  { payer: 'Sneha Iyer', payee: 'Vikram Chowdary', amount: 21000, txn_note: 'freelance website', txn_date: '2026-10-22' },
  // noise
  { payer: 'Divya Menon', payee: 'Vikram Chowdary', amount: 350, txn_note: 'biryani split', txn_date: '2026-11-15' },
  { payer: 'Manoj Varma', payee: 'Vikram Chowdary', amount: 1500, txn_note: 'speaker travel', txn_date: '2026-11-16' },
  { payer: 'Vikram Chowdary', payee: 'Farhan Ali', amount: 600, txn_note: 'cab split', txn_date: '2026-11-08' },
  { payer: 'Rhea Kapoor', payee: 'Manoj Varma', amount: 2400, txn_note: 'meetup snacks', txn_date: '2026-11-15' },
);
for (let i = 0; i < 160; i++) {
  const a = pick(F); let b = pick(F); if (a === b) b = F[(F.indexOf(a) + 1) % F.length];
  out.UPI_Payments.push({
    payer: a, payee: b, amount: int(5, 400) * 10, txn_note: pick(PAY_NOTES),
    txn_date: `2026-${pick(['09', '10', '11'])}-${pad(int(1, 28))}`,
  });
}

// ---------- write ----------
const dest = path.join(__dirname, '..', 'functions', 'zcql_api', 'data', 'seed-data.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
const counts = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]));
console.log('Wrote', path.relative(process.cwd(), dest), counts);
