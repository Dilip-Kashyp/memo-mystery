/* The Memo Mystery: client */
(function () {
  'use strict';

  var API = '/server/zcql_api';
  var $ = function (sel) { return document.querySelector(sel); };

  // ---------- safe storage (private windows can throw) ----------
  var store = {
    get: function (k, fallback) { try { var v = localStorage.getItem('memo.' + k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set: function (k, v) { try { localStorage.setItem('memo.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del: function (k) { try { localStorage.removeItem('memo.' + k); } catch (e) { /* ignore */ } },
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // ---------- tiny ZCQL highlighter ----------
  var KW = /^(SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|ORDER|BY|GROUP|HAVING|LIMIT|ASC|DESC|INNER|LEFT|JOIN|ON|AS|DISTINCT)$/i;
  var FN = /^(COUNT|SUM|AVG|MIN|MAX)$/i;
  function highlight(sql) {
    return sql.replace(/('(?:[^']|'')*')|([A-Za-z_][\w]*)|([^'A-Za-z_]+)/g, function (m, str, word, other) {
      if (str) return '<span class="s">' + esc(str) + '</span>';
      if (word) {
        if (KW.test(word)) return '<span class="k">' + esc(word) + '</span>';
        if (FN.test(word)) return '<span class="f">' + esc(word) + '</span>';
        if (/^(ROWID|CREATORID|CREATEDTIME|MODIFIEDTIME)$/.test(word)) return '<span class="n">' + word + '</span>';
        return esc(word);
      }
      return esc(other);
    });
  }

  // ---------- lessons ----------
  var LESSONS = [
    {
      title: 'Ask me for something',
      body: '“My clues live in tables, like pages in an evidence book. Say SELECT for what you want to see, then FROM for where to look.”',
      sql: 'SELECT full_name\nFROM Persons',
      meaning: 'Show me the names in the people table.',
    },
    {
      title: 'Give me a clue to match',
      body: '“Too many results? Say WHERE to keep only the ones that match. Put words inside single quotes.”',
      sql: "SELECT full_name, area\nFROM Persons\nWHERE area = 'Kondapur'",
      meaning: 'Show me people who live in Kondapur.',
    },
    {
      title: 'Match two clues at once',
      body: '“Say AND when both clues must match. This helps you narrow the search.”',
      sql: "SELECT event_name\nFROM Meetup_Events\nWHERE city = 'Hyderabad' AND event_date = '2026-11-15'",
      meaning: 'Show me meetups in Hyderabad on 15 November.',
    },
    {
      title: 'Remember only part of a name?',
      body: '“Say LIKE and use * for the missing letters. I use * for any number of letters, and ? for just one.”',
      sql: "SELECT full_name\nFROM Persons\nWHERE full_name LIKE 'Kavya *'",
      meaning: 'Show me everyone whose name starts with Kavya.',
    },
    {
      title: 'Put the clues in order',
      body: '“Say ORDER BY to sort the results. ASC goes from small to big, or early to late. DESC goes the other way.”',
      sql: 'SELECT event_name, event_date\nFROM Meetup_Events\nORDER BY event_date ASC',
      meaning: 'Show me the meetups, oldest first.',
    },
    {
      title: 'Just a few, please',
      body: '“Say LIMIT when you only want a few results. LIMIT 5 means show me the first five.”',
      sql: 'SELECT event_name, event_date\nFROM Meetup_Events\nORDER BY event_date ASC\nLIMIT 5',
      meaning: 'Show me just the five oldest meetups.',
    },
    {
      title: 'Connect two pages of evidence',
      body: '“Every person has a unique ID called ROWID. A check-in remembers it as person_id. Say JOIN to match those IDs and put the name beside the badge.”',
      sql: 'SELECT Persons.full_name, Event_Checkins.badge_type\nFROM Event_Checkins\nINNER JOIN Persons ON Event_Checkins.person_id = Persons.ROWID\nLIMIT 5',
      meaning: 'Show me five check-ins with each person’s name and badge.',
    },
    {
      title: 'Count the clues',
      body: '“Say COUNT to count records. GROUP BY makes a separate count for each kind of badge.”',
      sql: 'SELECT badge_type, COUNT(ROWID)\nFROM Event_Checkins\nGROUP BY badge_type',
      meaning: 'How many check-ins used each badge type?',
    },
    {
      title: 'Add up the money',
      body: '“Say SUM to add amounts together. GROUP BY gives each payer their own total. Follow the money!”',
      sql: 'SELECT payer_id, SUM(amount)\nFROM UPI_Payments\nGROUP BY payer_id',
      meaning: 'How much did each person pay in total?',
    },
  ];
  var lessonIndex = 0;
  function renderLessons() {
    var lesson = LESSONS[lessonIndex];
    $('#lessons').innerHTML = '<article class="lesson" role="group" aria-roledescription="slide" aria-label="' + (lessonIndex + 1) + ' of ' + LESSONS.length + '">' +
      '<div class="memo-note"><img src="memo.png" alt="" width="56" height="53" /><span>A note from Memo</span></div>' +
      '<h3>' + esc(lesson.title) + '</h3><p class="memo-words">' + esc(lesson.body) + '</p>' +
      '<pre>' + highlight(lesson.sql) + '</pre>' +
      '<p class="lesson-meaning"><span>In our words</span>' + esc(lesson.meaning) + '</p>' +
      '<button class="btn btn-small btn-ghost" type="button" data-lesson="' + lessonIndex + '">Try this in the console →</button></article>';
    $('#lesson-progress').textContent = (lessonIndex + 1) + ' of ' + LESSONS.length;
    // Keep both controls focusable at the ends so keyboard focus stays in place.
    $('#lesson-prev').setAttribute('aria-disabled', String(lessonIndex === 0));
    $('#lesson-next').setAttribute('aria-disabled', String(lessonIndex === LESSONS.length - 1));
  }
  $('#lessons').addEventListener('click', function (e) {
    var b = e.target.closest('[data-lesson]');
    if (b) loadAndRun(LESSONS[+b.dataset.lesson].sql);
  });
  $('#lesson-prev').addEventListener('click', function () {
    if (lessonIndex > 0) { lessonIndex--; renderLessons(); }
  });
  $('#lesson-next').addEventListener('click', function () {
    if (lessonIndex < LESSONS.length - 1) { lessonIndex++; renderLessons(); }
  });

  // ---------- three-query play arena ----------
  var records = window.MemoRecords;
  var cases = [];
  var round = restoreRound();
  var busy = false;
  var loading = false;
  var requestSerial = 0;
  function restoreRound() {
    try {
      var saved = JSON.parse(sessionStorage.getItem('memo.arena-round'));
      if (saved && saved.version === 2 && saved.case && saved.case.questions.length === 3 && Array.isArray(saved.answers)) return saved;
    } catch (e) { /* start fresh */ }
    return null;
  }
  function saveRound() {
    if (!round || round.practice) return;
    try { sessionStorage.setItem('memo.arena-round', JSON.stringify(round)); } catch (e) { /* game still works */ }
  }
  function fmt(ms) {
    var seconds = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }
  function elapsed() { return round ? (round.finished || Date.now()) - round.started : 0; }
  function score() { return round ? round.answers.filter(function (a) { return a.verdict.correct; }).length : 0; }
  function question() { return round.case.questions[round.index]; }
  function currentAnswer() { return round.answers[round.index]; }
  function sqlText() { return round.selected.map(function (id) { return question().tiles.find(function (t) { return t.id === id; }).text; }).join(' '); }
  function formatted(sql) { return sql.replace(/\s+(FROM|WHERE|INNER JOIN|LEFT JOIN|GROUP BY|ORDER BY|LIMIT)\b/g, '\n$1'); }
  async function api(path, body) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 15000);
    try {
      var response = await fetch(API + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal } : { signal: controller.signal });
      var data = await response.json();
      if (path === '/query' && response.status === 400 && data.error) return { rows: [], columns: [], queryError: data.error };
      if (!response.ok || data.error) throw new Error(data.error || 'The evidence locker is unavailable. Try again.');
      return data;
    } finally { clearTimeout(timeout); }
  }
  async function loadCases() {
    if (!cases.length) cases = (await api('/arena')).cases;
    return cases;
  }
  function fallbackCase(ids) {
    var saved = store.get('caseQueue', { queue: [], last: null });
    var queue = saved.queue.filter(function (id) { return ids.indexOf(id) >= 0; });
    if (!queue.length) {
      queue = records.shuffle(ids);
      if (queue.length > 1 && queue[0] === saved.last) queue.push(queue.shift());
    }
    var id = queue.shift();
    store.set('caseQueue', { queue: queue, last: id });
    return id;
  }
  async function startRound(fresh) {
    if (loading || busy) return;
    if (!fresh && round && !round.finished && !round.practice) { location.hash = 'play'; route(); return; }
    var nameInput = $('#detective-name');
    var name = nameInput.value.trim();
    nameInput.setCustomValidity(name ? '' : 'Please enter your detective name.');
    if (!nameInput.checkValidity()) {
      location.hash = 'case'; route();
      $('#start-status').textContent = 'Enter your detective name to start.';
      nameInput.focus();
      nameInput.reportValidity();
      return;
    }
    loading = true;
    $('#start-btn').disabled = true;
    $('#start-status').textContent = 'Opening a new case…';
    try {
      await loadCases();
      var ids = cases.map(function (c) { return c.id; });
      var id;
      try { id = await records.nextCase(ids); } catch (e) { id = fallbackCase(ids); }
      var selectedCase = cases.find(function (c) { return c.id === id; });
      $('#detective-name').value = '';
      round = { version: 2, id: crypto.randomUUID(), player: name, case: selectedCase, index: 0, selected: [], answers: [], started: Date.now(), finished: null, orders: selectedCase.questions.map(function (q) { return records.shuffle(q.tiles.map(function (t) { return t.id; })); }) };
      saveRound();
      location.hash = 'play'; route();
      $('#question-title').focus({ preventScroll: true });
    } catch (e) {
      $('#start-status').textContent = 'Could not open a case. Check the server and try Start again.';
    } finally { loading = false; $('#start-btn').disabled = false; }
  }
  function route() {
    if (busy && location.hash !== '#play') { location.hash = 'play'; return; }
    var playing = location.hash === '#play' && !!round;
    $('#home-screen').hidden = playing;
    $('.footer').hidden = playing;
    $('.topnav').hidden = playing;
    $('#play').hidden = !playing;
    $('#timer').hidden = !playing;
    document.body.classList.toggle('is-playing', playing);
    if (playing) {
      renderArena();
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      if (round && round.practice) round = restoreRound();
      $('#start-btn').textContent = round && !round.finished ? 'Resume investigation' : 'Start investigation';
      $('#start-status').textContent = round && !round.finished ? 'Your case is saved. The timer keeps running until you finish.' : 'No sign-up. Scores stay in this browser.';
      if (location.hash === '#leaderboard') renderLeaderboard();
    }
  }
  function renderArena() {
    var done = !!round.finished && round.answers.length === round.case.questions.length && round.index >= round.case.questions.length;
    $('#exit-round').hidden = done;
    $('#arena-question-screen').hidden = done;
    $('#round-summary').hidden = !done;
    $('#arena-case').textContent = round.practice ? 'Memo’s practice room' : round.case.title;
    $('#arena-score').textContent = score() + ' / ' + round.case.questions.length + ' correct';
    $('#timer-text').textContent = fmt(elapsed());
    if (done) { renderSummary(); return; }
    var q = question();
    $('#question-number').textContent = round.practice ? 'Practice · no leaderboard score' : 'Question ' + (round.index + 1) + ' of 3';
    $('#question-title').textContent = q.prompt;
    $('#case-story').textContent = round.case.story;
    var completed = round.answers.length;
    $('#arena-progress').setAttribute('aria-valuemax', round.case.questions.length);
    $('#arena-progress').setAttribute('aria-valuenow', completed);
    $('#arena-progress span').style.width = (completed / round.case.questions.length * 100) + '%';
    $('#arena-schema').innerHTML = q.tables.map(function (t) {
      return '<details class="arena-table"' + (matchMedia('(max-width: 850px)').matches ? '' : ' open') + '><summary>' + esc(t.name) + '</summary><ul>' + t.columns.map(function (c) {
        return '<li><code>' + esc(c.name) + '</code><span>' + esc(c.fk ? '→ ' + c.fk.table + '.ROWID' : c.type) + '</span></li>';
      }).join('') + '</ul></details>';
    }).join('');
    renderTiles();
    renderFeedback();
  }
  function renderTiles() {
    var q = question();
    var locked = busy || !!currentAnswer();
    var lines = [];
    var line = '';
    round.selected.forEach(function (id) {
      var tile = q.tiles.find(function (t) { return t.id === id; });
      if (/^(FROM|WHERE|INNER JOIN|LEFT JOIN|GROUP BY|ORDER BY|LIMIT)$/.test(tile.text) && line) { lines.push(line); line = ''; }
      line += '<button type="button" class="console-tile" data-remove="' + esc(id) + '" aria-label="Remove ' + esc(tile.text) + '"' + (locked ? ' disabled' : '') + '>' + highlight(tile.text) + '</button> ';
    });
    if (line) lines.push(line);
    $('#arena-console').innerHTML = lines.length ? lines.map(function (row) { return '<div class="sql-line">' + row + '</div>'; }).join('') : '<p class="console-placeholder">Your query starts here.<br />Tap the words below to talk to Memo.</p>';
    $('#tile-bank').innerHTML = round.orders[round.index].map(function (id) {
      var tile = q.tiles.find(function (t) { return t.id === id; });
      var used = round.selected.indexOf(id) >= 0;
      return '<button type="button" class="word-tile' + (used ? ' used' : '') + '" data-tile="' + esc(id) + '"' + (locked || used ? ' disabled' : '') + ' aria-label="Add ' + esc(tile.text) + '"><code>' + esc(tile.text) + '</code></button>';
    }).join('');
    $('#tile-count').textContent = round.selected.length + ' pieces placed';
    $('#arena-run').disabled = locked || !round.selected.length;
    $('#arena-run').hidden = !!currentAnswer();
    $('#undo-tile').disabled = $('#clear-tiles').disabled = locked || !round.selected.length;
    $('#arena-message').textContent = busy ? 'Reading the evidence…' : currentAnswer() ? 'Read your results, then continue.' : 'Build your query, then press Run.';
  }
  function renderFeedback() {
    var answer = currentAnswer();
    $('#arena-feedback').hidden = !answer;
    $('#arena-results').hidden = !answer;
    $('#arena-next').hidden = !answer;
    if (!answer) return;
    var v = answer.verdict;
    $('#arena-feedback').className = 'arena-feedback ' + (v.correct ? 'correct' : 'incorrect');
    $('#arena-feedback').innerHTML = '<h2>' + (v.correct ? '✓ Good detective work!' : 'A clue for next time') + '</h2><p>' + esc(v.explanation) + '</p>' +
      (!v.correct ? '<details><summary>See the matching query</summary><pre>' + highlight(formatted(v.solution)) + '</pre></details>' : '');
    $('#arena-result-status').textContent = v.queryError ? 'The query could not run' : v.rows.length + ' matching record' + (v.rows.length === 1 ? '' : 's') + (v.truncated ? ' · showing the first 300' : '');
    $('#arena-result-grid').innerHTML = v.queryError ? '<p class="msg err">' + esc(v.queryError) + '</p>' : !v.rows.length ? '<p class="msg">No records matched this query.</p>' : '<table class="grid"><thead><tr>' + v.columns.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + v.rows.map(function (row) {
      return '<tr>' + row.map(function (value) { return '<td>' + esc(value == null ? 'null' : value) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
    $('#arena-next').textContent = round.practice ? 'Finish practice' : round.index === 2 ? 'See my detective rating' : 'Next question';
  }
  function animateTile(button) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !button.animate) return;
    var source = button.getBoundingClientRect();
    var target = $('#arena-console').getBoundingClientRect();
    var ghost = document.createElement('span');
    ghost.className = 'flying-fragment'; ghost.textContent = button.textContent;
    ghost.style.left = source.left + 'px'; ghost.style.top = source.top + 'px';
    document.body.appendChild(ghost);
    var animation = ghost.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(' + (target.left - source.left + 20) + 'px,' + (target.top - source.top + 20) + 'px) scale(.8)', opacity: 0 }], { duration: 340, easing: 'ease-out' });
    animation.onfinish = animation.oncancel = function () { ghost.remove(); };
  }
  $('#tile-bank').addEventListener('click', function (e) {
    var button = e.target.closest('[data-tile]');
    if (!button || busy || currentAnswer() || round.selected.indexOf(button.dataset.tile) >= 0) return;
    var index = round.orders[round.index].indexOf(button.dataset.tile);
    animateTile(button);
    round.selected.push(button.dataset.tile); saveRound(); renderTiles();
    var available = Array.from($('#tile-bank').querySelectorAll('button'));
    var next = available.slice(index + 1).concat(available.slice(0, index)).find(function (b) { return !b.disabled; });
    if (next) next.focus({ preventScroll: true });
  });
  $('#arena-console').addEventListener('click', function (e) {
    var b = e.target.closest('[data-remove]');
    if (!b || busy || currentAnswer()) return;
    var id = b.dataset.remove;
    round.selected = round.selected.filter(function (value) { return value !== id; });
    saveRound(); renderTiles();
    $('#tile-bank').querySelector('[data-tile="' + id + '"]').focus({ preventScroll: true });
  });
  $('#undo-tile').addEventListener('click', function () { if (!busy && !currentAnswer()) { round.selected.pop(); saveRound(); renderTiles(); } });
  $('#clear-tiles').addEventListener('click', function () { if (!busy && !currentAnswer()) { round.selected = []; saveRound(); renderTiles(); } });
  $('#arena-run').addEventListener('click', async function () {
    if (busy || currentAnswer() || !round.selected.length) return;
    var sql = sqlText();
    var serial = ++requestSerial;
    busy = true; renderTiles();
    try {
      var verdict;
      if (round.practice) {
        var data = await api('/query', { query: sql });
        verdict = Object.assign({}, data, { correct: !data.queryError && sql === question().solution, solution: question().solution, explanation: question().explanation });
      } else verdict = await api('/arena/query', { id: question().id, query: sql });
      if (serial !== requestSerial) return;
      round.answers.push({ id: question().id, sql: sql, verdict: verdict });
      if (round.answers.length === round.case.questions.length) round.finished = Date.now();
      saveRound();
      busy = false; renderArena();
      $('#arena-feedback').focus({ preventScroll: true });
      $('#arena-feedback').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    } catch (e) { if (serial === requestSerial) $('#arena-message').textContent = 'Could not read the evidence. Your answer is not scored. Press Run to retry.'; }
    finally {
      if (serial !== requestSerial) return;
      busy = false;
      $('#arena-run').disabled = !!currentAnswer();
      $('#undo-tile').disabled = $('#clear-tiles').disabled = !!currentAnswer() || !round.selected.length;
      if (!currentAnswer()) $('#tile-bank').querySelectorAll('button').forEach(function (b) { b.disabled = round.selected.indexOf(b.dataset.tile) >= 0; });
    }
  });
  $('#arena-next').addEventListener('click', function () {
    if (busy || !currentAnswer()) return;
    round.index++;
    round.selected = [];
    saveRound(); renderArena();
    window.scrollTo({ top: 0, behavior: 'instant' });
    (round.index >= round.case.questions.length ? $('#round-summary') : $('#question-title')).focus({ preventScroll: true });
  });
  function rating(points) { return ['Detective in training', 'Clue spotter', 'Sharp-eyed detective', 'Master Detective'][points]; }
  function renderSummary() {
    var points = score();
    var total = round.case.questions.length;
    var message = round.practice ? 'A little practice goes a long way. Ready for a full case?' : [
      'Every detective starts somewhere. Try another case and keep learning Memo’s language.',
      'You found one trail. Another case will help sharpen your ZCQL.',
      'Two trails solved! One more correct query gets you Master Detective.',
      'Three queries. Three solid leads. Memo has found his detective!'
    ][points];
    $('#round-summary').innerHTML = '<img src="memo.png" width="100" height="94" alt="Memo celebrates your investigation" /><p class="eyebrow">' + (round.practice ? 'Practice complete' : 'Investigation complete') + '</p><h1>' + (round.practice ? 'You spoke Memo’s language' : rating(points)) + '</h1><p>' + esc(message) + '</p><div class="summary-stats"><div><strong>' + points + ' / ' + total + '</strong><span>Queries solved</span></div><div><strong>' + Math.round(points / total * 100) + '%</strong><span>Accuracy</span></div><div><strong>' + fmt(elapsed()) + '</strong><span>Round time</span></div></div>' +
      '<div class="round-review">' + round.answers.map(function (a, i) { return '<p><span>' + (a.verdict.correct ? '✓' : '○') + '</span> Question ' + (i + 1) + ': ' + esc(round.case.questions[i].prompt) + '</p>'; }).join('') + '</div>' +
      '<p id="score-save-status" class="small muted" role="status">' + (round.practice ? 'Practice is not added to the leaderboard.' : 'Saving your score in this browser…') + '</p><div class="hero-actions"><button type="button" class="btn btn-primary" id="play-again">Play a new case</button><a class="btn btn-ghost" href="#leaderboard">View leaderboard</a><a class="link-btn" href="#academy">Learn with Memo</a></div>';
    if (!round.practice) saveScore();
  }
  async function saveScore() {
    var finishedRound = round;
    if (!finishedRound || finishedRound.practice || !finishedRound.finished || finishedRound.answers.length !== 3 || finishedRound.index < 3) return;
    try {
      await records.save({ id: finishedRound.id, name: finishedRound.player, caseTitle: finishedRound.case.title, score: score(), elapsed: elapsed(), finished: finishedRound.finished });
      if (round === finishedRound && $('#score-save-status')) $('#score-save-status').textContent = 'Result saved in this browser. The top ten scores appear on the leaderboard; faster times break ties.';
    } catch (e) {
      if (round === finishedRound && $('#score-save-status')) $('#score-save-status').innerHTML = 'Your score could not be saved. Browser storage may be blocked. <button type="button" class="link-btn" id="retry-save">Retry saving</button>';
    }
  }
  $('#round-summary').addEventListener('click', function (e) {
    if (e.target.closest('#play-again')) {
      round = null;
      try { sessionStorage.removeItem('memo.arena-round'); } catch (err) { /* ignore */ }
      $('#detective-name').value = '';
      location.hash = 'case'; route();
      $('#detective-name').focus();
    }
    if (e.target.closest('#retry-save')) saveScore();
  });
  var leaderboardRender = 0;
  async function renderLeaderboard() {
    var version = ++leaderboardRender;
    var old = $('#leaderboard-list');
    try {
      var results = await records.topScores();
      if (version !== leaderboardRender) return;
      old.innerHTML = (results.length ? '<div class="result-card"><div class="result"><table class="grid"><thead><tr><th scope="col">Rank</th><th scope="col">Detective</th><th scope="col">Case</th><th scope="col">Score</th><th scope="col">Time</th></tr></thead><tbody>' + results.map(function (r, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.caseTitle) + '</td><td>' + r.score + ' / 3</td><td>' + fmt(r.elapsed) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' : '<div class="panel"><p>No scores yet. Finish a case to earn your place.</p></div>');
    } catch (e) { if (version === leaderboardRender) old.innerHTML = '<p class="muted">Leaderboard unavailable. Allow browser storage to save your scores. You can still play.</p>'; }
  }
  function loadAndRun(sql) {
    if (busy || loading) return;
    var lesson = LESSONS.find(function (l) { return l.sql === sql; });
    var texts = sql.match(/'(?:[^']|'')*'|(?:ORDER BY|GROUP BY|INNER JOIN|LEFT JOIN)|[^\s]+/g);
    var tables = [];
    // Only definitions already loaded from the evidence locker are used in practice.
    schemaTables.forEach(function (t) { if (new RegExp('\\b' + t.name + '\\b').test(sql)) tables.push(Object.assign({}, t, { columns: [{ name: 'ROWID', type: 'BigInt' }].concat(t.columns) })); });
    var tiles = texts.map(function (text, i) { return { id: 'practice-' + i, text: text }; });
    var q = { id: 'practice', prompt: lesson.meaning, solution: sql.replace(/\s+/g, ' '), explanation: lesson.body, tiles: tiles, tables: tables };
    round = { practice: true, case: { title: 'Practice', story: 'Try this note from Memo. Practice does not affect your leaderboard score.', questions: [q] }, index: 0, selected: [], answers: [], started: Date.now(), finished: null, orders: [records.shuffle(tiles.map(function (t) { return t.id; }))] };
    location.hash = 'play'; route();
  }
  var schemaTables = [];
  store.del('player');
  $('#detective-name').value = '';
  $('#detective-name').addEventListener('input', function () { this.setCustomValidity(''); });
  $('#exit-round').addEventListener('click', function () {
    // Invalidate an in-flight Run response before dropping the round.
    requestSerial++;
    busy = false;
    if (!round || !round.practice) {
      try { sessionStorage.removeItem('memo.arena-round'); } catch (err) { /* ignore */ }
    }
    round = restoreRound();
    $('#detective-name').value = '';
    location.hash = 'case'; route();
    $('#start-status').textContent = 'Game exited. No score was recorded for this attempt.';
  });
  $('#start-form').addEventListener('submit', function (e) { e.preventDefault(); startRound(false); });
  document.querySelectorAll('[data-start]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); startRound(false); }); });
  window.addEventListener('hashchange', route);
  records.subscribe(renderLeaderboard);
  window.addEventListener('pageshow', renderLeaderboard);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) renderLeaderboard(); });
  setInterval(function () { if (round && !round.finished && location.hash === '#play') $('#timer-text').textContent = fmt(elapsed()); }, 1000);
  renderLessons();
  renderLeaderboard();
  route();
  api('/schema').then(function (data) {
    schemaTables = data.tables;
    var badge = $('#mode-badge');
    badge.textContent = data.mode === 'catalyst' ? '● Catalyst Data Store' : '● local simulator';
    badge.className = 'mode-badge ' + (data.mode === 'catalyst' ? 'live' : 'local');
  }).catch(function () { $('#mode-badge').textContent = 'offline'; });
})();
