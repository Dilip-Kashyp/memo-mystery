'use strict';
/**
 * Answer checking lives on the server so the solution never ships to the browser.
 */
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

const STAGES = {
  kidnapper: {
    answer: 'vikram chowdary',
    correct: {
      title: 'Kidnapper caught!',
      body:
        "Officers find Vikram Chowdary in Kondapur with a suspiciously squeaky laptop bag (empty, sadly) and a sticker that says <code>shouldComponentUpdate() { return false }</code>. " +
        "He cracks under questioning, but swears he was only the delivery boy.<br><br>" +
        "<strong>Stage 2:</strong> Read Vikram's own statement in <code>Witness_Statements</code>. Someone paid him. " +
        "Can you find the mastermind? Follow the money, then check the organizers.",
    },
    wrong:
      "That person has an alibi the size of a <code>node_modules</code> folder. Re-check the witness clues: badge, checkout time, the auto's plate, and the workshop.",
  },
  mastermind: {
    answer: 'rhea kapoor',
    correct: {
      title: 'Case closed. Memo is home!',
      body:
        "Rhea Kapoor, an organizer of ReactHyderabad, was planning her own meetup across town and wanted Memo as its star. " +
        "Police found Memo in her Kondapur flat, wrapped in <code>React.memo</code> with a comparator that always returned <code>true</code>. " +
        "He hadn't re-rendered in days, but he is safe, happy and back on the ReactHyderabad stage.<br><br>" +
        "Along the way you used the Catalyst Data Store: system columns like <code>ROWID</code>, foreign keys, " +
        "ZCQL's <code>*</code> wildcard, <code>INNER JOIN</code>, <code>GROUP BY</code> with <code>SUM()</code> and <code>COUNT()</code>, and <code>IN</code>. 🎉",
    },
    wrong:
      "Close, but the money trail doesn't add up. Vikram said <em>November</em>, <em>₹21,000 in total</em>, and an organizer at <em>every</em> meetup since September. Check all three.",
  },
};

function checkAnswer(stage, name) {
  const s = STAGES[stage];
  if (!s) return { ok: false, error: 'Unknown stage.' };
  const guess = norm(name);
  if (!guess) return { ok: false, error: 'Enter a full name.' };
  if (guess === s.answer) return { ok: true, correct: true, stage, ...s.correct };
  const first = s.answer.split(' ')[0];
  if (guess === first) {
    return { ok: true, correct: false, message: 'Getting warm! Submit their full name exactly as it appears in Persons.' };
  }
  return { ok: true, correct: false, message: s.wrong };
}

module.exports = { checkAnswer };
