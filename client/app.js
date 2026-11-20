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
      title: 'Tables come with system columns',
      body: '<p>Every table you create in the Catalyst Data Store automatically gets four columns:</p>' +
        '<ul><li><code>ROWID</code>: unique BigInt primary key for each row</li><li><code>CREATORID</code>: who inserted it</li><li><code>CREATEDTIME</code> / <code>MODIFIEDTIME</code>: audit timestamps</li></ul>',
      sql: 'SELECT ROWID, CREATEDTIME, full_name, area\nFROM Persons\nLIMIT 5',
    },
    {
      title: 'Filter with WHERE',
      body: '<p>Text values go in <strong>single quotes</strong>. Dates are <code>\'YYYY-MM-DD\'</code> and date-times are <code>\'YYYY-MM-DD HH:MM:SS\'</code>. ZCQL allows up to <strong>5 conditions</strong> joined with <code>AND</code>/<code>OR</code>.</p>',
      sql: "SELECT event_name, event_date, venue\nFROM Meetup_Events\nWHERE city = 'Hyderabad' AND event_date >= '2026-11-01'",
    },
    {
      title: 'Wildcards are * and ?, not %',
      body: '<p>This trips up every SQL veteran. In ZCQL, <code>LIKE</code> uses <code>*</code> for "any number of characters" and <code>?</code> for "exactly one character". A <code>%</code> is just a percent sign.</p>',
      sql: "SELECT full_name, area\nFROM Persons\nWHERE full_name LIKE '*Rao'",
    },
    {
      title: 'Sort and page with ORDER BY & LIMIT',
      body: '<p><code>LIMIT n</code> returns the first n rows. To page, ZCQL uses <code>LIMIT offset, count</code>. ZCQL caps how many rows one query returns (300 here), so paging matters on big tables.</p>',
      sql: 'SELECT full_name, address_number, address_street\nFROM Persons\nORDER BY address_number DESC\nLIMIT 0, 5',
    },
    {
      title: 'Count and group',
      body: '<p>Aggregates: <code>COUNT()</code>, <code>SUM()</code>, <code>AVG()</code>, <code>MIN()</code>, <code>MAX()</code> and <code>DISTINCT</code>. Combine them with <code>GROUP BY</code>. <code>IN (…)</code> matches any value in a list.</p>',
      sql: 'SELECT badge_type, COUNT(ROWID)\nFROM Event_Checkins\nGROUP BY badge_type',
    },
    {
      title: 'Foreign keys and JOINs',
      body: '<p>A <strong>Foreign Key</strong> column stores the <code>ROWID</code> of a row in its parent table. ZCQL joins must link that FK column to the parent\'s <code>ROWID</code>.</p>' +
        '<ul><li>Only <code>INNER JOIN</code> and <code>LEFT JOIN</code></li><li>At most 4 joins per query</li><li>Prefix columns with the table name: <code>Persons.full_name</code></li></ul>',
      sql: 'SELECT Persons.full_name, Event_Checkins.badge_type\nFROM Event_Checkins\nINNER JOIN Persons ON Event_Checkins.person_id = Persons.ROWID\nLIMIT 5',
    },
    {
      title: 'How this app talks to the Data Store',
      body: '<p>Behind the console, a Catalyst <strong>Advanced I/O function</strong> runs your query with the Node.js SDK. In your own projects, ZCQL can also <code>INSERT</code>, <code>UPDATE</code> and <code>DELETE</code>. This console is read-only.</p>',
      code: "const catalyst = require('zcatalyst-sdk-node');\n\napp.post('/query', async (req, res) => {\n  const app = catalyst.initialize(req);\n  const rows = await app.zcql()\n    .executeZCQLQuery(req.body.query);\n  // rows = [{ Persons: { full_name: '…' } }, …]\n  res.json(rows);\n});",
    },
  ];

  function renderLessons() {
    var html = LESSONS.map(function (l, i) {
      var snippet = l.sql ? highlight(l.sql) : esc(l.code);
      return '<article class="lesson' + (l.sql ? '' : ' no-run') + '">' +
        '<h3><span class="lesson-num">' + String(i + 1).padStart(2, '0') + '</span>' + esc(l.title) + '</h3>' +
        l.body + '<pre>' + snippet + '</pre>' +
        (l.sql ? '<button class="btn btn-small btn-ghost" type="button" data-lesson="' + i + '">▶ Try it in the console</button>' : '') +
        '</article>';
    }).join('');
    $('#lessons').innerHTML = html;
    $('#lessons').addEventListener('click', function (e) {
      var b = e.target.closest('[data-lesson]');
      if (!b) return;
      loadAndRun(LESSONS[+b.dataset.lesson].sql);
    });
  }

  // ---------- schema ----------
  var showSystem = store.get('showSystem', false);
  function renderSchema(data) {
    var sys = data.systemColumns || [];
    var html = data.tables.map(function (t) {
      var cols = sys.map(function (c) {
        return '<li class="sys"' + (showSystem ? '' : ' hidden') + '><button type="button" data-col="' + c.name + '">' + c.name + '</button><span class="t">' + c.type + '</span></li>';
      }).join('') + t.columns.map(function (c) {
        var type = c.fk ? '<span class="fk" title="Foreign key to ' + c.fk.table + '.ROWID">→ ' + c.fk.table + '.ROWID</span>' : '<span class="t">' + c.type + '</span>';
        return '<li><button type="button" data-col="' + c.name + '">' + c.name + '</button>' + type + '</li>';
      }).join('');
      return '<div class="tbl"><button class="tbl-name" type="button" data-table="' + t.name + '"><span>' + t.name + '</span><span class="tbl-peek">peek ▸</span></button>' +
        '<p class="tbl-about">' + esc(t.about || '') + '</p><ul class="cols">' + cols + '</ul></div>';
    }).join('');
    $('#schema-list').innerHTML = html;
    syncSystemToggle();
  }
  function syncSystemToggle() {
    var btn = $('#toggle-system');
    btn.textContent = showSystem ? 'Hide system columns' : 'Show system columns';
    btn.setAttribute('aria-pressed', String(showSystem));
    document.querySelectorAll('.cols li.sys').forEach(function (li) { li.hidden = !showSystem; });
  }
  $('#toggle-system').addEventListener('click', function () { showSystem = !showSystem; store.set('showSystem', showSystem); syncSystemToggle(); });
  $('#schema-list').addEventListener('click', function (e) {
    var t = e.target.closest('[data-table]');
    if (t) return loadAndRun('SELECT * FROM ' + t.dataset.table + ' LIMIT 10');
    var c = e.target.closest('[data-col]');
    if (c) insertAtCursor(c.dataset.col);
  });

  // ---------- editor ----------
  var editor = $('#editor');
  editor.value = store.get('draft', editor.value);
  editor.addEventListener('input', function () { store.set('draft', editor.value); });
  editor.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runQuery(); }
    else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); insertAtCursor('  '); }
  });
  function insertAtCursor(text) {
    var s = editor.selectionStart, en = editor.selectionEnd;
    editor.value = editor.value.slice(0, s) + text + editor.value.slice(en);
    editor.selectionStart = editor.selectionEnd = s + text.length;
    editor.focus();
    store.set('draft', editor.value);
  }
  function loadAndRun(sql) {
    editor.value = sql;
    store.set('draft', sql);
    $('#console').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    runQuery();
  }
  $('#run-btn').addEventListener('click', runQuery);
  $('#clear-btn').addEventListener('click', function () { editor.value = ''; store.set('draft', ''); editor.focus(); });

  // ---------- investigation timer ----------
  // State survives refreshes: { start: epoch ms, end: epoch ms | null, splits: { kidnapper: ms, mastermind: ms } }
  var timer = store.get('timer', null);
  function fmtTime(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var mmss = String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    return h ? h + ':' + mmss : mmss;
  }
  function elapsed() { return timer ? (timer.end || Date.now()) - timer.start : 0; }
  function renderTimer() {
    var box = $('#timer');
    box.classList.toggle('running', !!timer && !timer.end);
    box.classList.toggle('done', !!timer && !!timer.end);
    $('#timer-text').textContent = timer ? fmtTime(elapsed()) + (timer.end ? ' ✓' : '') : 'Start timer';
    $('#timer-display').title = !timer ? 'Investigation time. Starts with your first query, or click to start now.'
      : timer.end ? 'Case closed in ' + fmtTime(elapsed()) : 'Investigation time so far';
    $('#timer-reset').hidden = !timer;
    ['kidnapper', 'mastermind'].forEach(function (stage) {
      var p = $('#form-' + stage + ' .split');
      var t = timer && timer.splits && timer.splits[stage];
      p.hidden = t == null;
      if (t != null) p.textContent = '⏱ ' + (stage === 'kidnapper' ? 'Kidnapper caught at ' : 'Case closed in ') + fmtTime(t);
    });
  }
  function startTimer() {
    if (timer) return;
    timer = { start: Date.now(), end: null, splits: {} };
    store.set('timer', timer);
    renderTimer();
  }
  function recordSplit(stage) {
    if (!timer) return;
    if (timer.splits[stage] == null) timer.splits[stage] = Date.now() - timer.start;
    if (stage === 'mastermind' && !timer.end) timer.end = timer.start + timer.splits.mastermind;
    store.set('timer', timer);
    renderTimer();
  }
  $('#timer-display').addEventListener('click', startTimer);
  $('#timer-reset').addEventListener('click', function () {
    if (!confirm('Reset the investigation timer to zero? Your answers and notes are kept.')) return;
    timer = null;
    store.del('timer');
    renderTimer();
  });
  setInterval(function () { if (timer && !timer.end) renderTimer(); }, 1000);

  // ---------- running queries ----------
  var running = false;
  function tipsFor(sql, error, rowCount) {
    var tips = [];
    if (/like\s+'[^']*%[^']*'/i.test(sql)) tips.push("ZCQL wildcards are <code>*</code> (many characters) and <code>?</code> (one character). <code>%</code> only matches a literal percent sign.");
    if (/=\s*"[^"]*"/.test(sql)) tips.push('Use single quotes for text values: <code>city = \'Hyderabad\'</code>.');
    if (error && /join|relationship/i.test(error)) tips.push('Join a foreign-key column to the parent ROWID, e.g. <code>ON Event_Checkins.person_id = Persons.ROWID</code>.');
    if (error && /column/i.test(error)) tips.push('Check the column names in the schema panel. With JOINs, prefix them: <code>Persons.full_name</code>.');
    if (!error && rowCount === 0 && /=\s*'/.test(sql)) tips.push("<code>=</code> needs an exact match. Not sure of the spelling? Try <code>LIKE '*part*'</code>.");
    return tips.map(function (t) { return '<span class="tip">💡 ' + t + '</span>'; }).join('');
  }

  function runQuery() {
    var sql = editor.value.trim();
    if (!sql || running) return;
    running = true;
    startTimer();
    $('#run-btn').disabled = true;
    $('#result-status').textContent = 'Running…';
    fetch(API + '/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
      .then(function (r) { return r.json().catch(function () { return { error: 'Server returned ' + r.status }; }); })
      .then(function (data) {
        if (data.error) {
          $('#result-status').innerHTML = '<span style="color:var(--err)">Query failed</span>';
          $('#result').innerHTML = '<div class="msg err"><strong>Error</strong>' + esc(data.error) + tipsFor(sql, data.error, 0) + '</div>';
          addHistory(sql, false);
          return;
        }
        renderGrid(data, sql);
        addHistory(sql, true);
      })
      .catch(function () {
        $('#result-status').textContent = 'Network error';
        $('#result').innerHTML = '<div class="msg err"><strong>Could not reach the server.</strong>Is the zcql_api function deployed (or the local dev server running)?</div>';
      })
      .finally(function () { running = false; $('#run-btn').disabled = false; });
  }

  function renderGrid(data, sql) {
    var n = data.rows.length;
    $('#result-status').textContent = n + ' row' + (n === 1 ? '' : 's') + (data.truncated ? ' (truncated to 300, use LIMIT offset, count to page)' : '') + (data.ms != null ? ' · ' + data.ms + ' ms' : '');
    if (!n) {
      $('#result').innerHTML = '<div class="msg">No rows matched.' + tipsFor(sql, null, 0) + '</div>';
      return;
    }
    var head = '<tr>' + data.columns.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr>';
    var body = data.rows.map(function (row) {
      return '<tr>' + row.map(function (v) {
        if (v === null || v === undefined || v === '') return '<td class="null">null</td>';
        var s = String(v);
        return '<td' + (s.length > 60 ? ' class="long"' : '') + '>' + esc(s) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var tip = /like\s+'[^']*%[^']*'/i.test(sql) ? '<div class="msg">' + tipsFor(sql, null, n) + '</div>' : '';
    $('#result').innerHTML = tip + '<table class="grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  $('#result').addEventListener('click', function (e) {
    var td = e.target.closest('td');
    if (!td || td.classList.contains('null')) return;
    var text = td.textContent;
    var done = function () { var t = $('#copy-toast'); t.hidden = false; clearTimeout(done.t); done.t = setTimeout(function () { t.hidden = true; }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
  });

  // ---------- history ----------
  function addHistory(sql, ok) {
    var h = store.get('history', []).filter(function (x) { return x.q !== sql; });
    h.unshift({ q: sql, ok: ok });
    store.set('history', h.slice(0, 40));
    renderHistory();
  }
  function renderHistory() {
    var h = store.get('history', []);
    $('#history').innerHTML = h.length
      ? h.map(function (x, i) { return '<li class="' + (x.ok ? 'good' : 'bad') + '"><button type="button" data-h="' + i + '" title="' + esc(x.q) + '">' + esc(x.q.replace(/\s+/g, ' ')) + '</button></li>'; }).join('')
      : '<li class="empty">Your queries will show up here.</li>';
  }
  $('#history').addEventListener('click', function (e) {
    var b = e.target.closest('[data-h]');
    if (!b) return;
    editor.value = store.get('history', [])[+b.dataset.h].q;
    store.set('draft', editor.value);
    editor.focus();
  });
  $('#clear-history').addEventListener('click', function () { store.set('history', []); renderHistory(); });

  // ---------- notebook ----------
  var nb = $('#notebook');
  nb.value = store.get('notebook', '');
  nb.addEventListener('input', function () { store.set('notebook', nb.value); });

  // ---------- hints ----------
  var HINTS = [
    ['Where do I start?', 'Find the crime scene report in <code>Incident_Reports</code>. Filter on <code>incident_date</code>, <code>city</code> and <code>incident_type</code>, and remember single quotes.'],
    ['Finding witness #1', 'First get the meetup\'s <code>ROWID</code> from <code>Meetup_Events</code> (a <code>LIKE</code> with <code>*</code> helps). Then look in <code>Event_Checkins</code> for that <code>event_id</code> and <code>badge_type</code>, sorted by <code>checkin_time</code>.<pre>' + highlight("... ORDER BY checkin_time ASC LIMIT 1") + '</pre>'],
    ['Finding witness #2', 'Search <code>Persons</code> by name pattern <em>and</em> street. Careful: there are several Kavyas, and more than one street in Kondapur.'],
    ['Reading statements', 'Statements are keyed by <code>person_id</code>, a foreign key to <code>Persons.ROWID</code>. Join them so you can filter by name:<pre>' + highlight('SELECT Persons.full_name, Witness_Statements.transcript\nFROM Witness_Statements\nINNER JOIN Persons ON Witness_Statements.person_id = Persons.ROWID') + '</pre>'],
    ['Narrowing the suspects', 'Build three lists and find who\'s on all of them: <strong>Speakers</strong> who checked out of Meetup #42 around 8:45 PM, <strong>autos</strong> on 2026-11-15 with a plate matching <code>\'TS09*7\'</code>, and <strong>commits</strong> on 2026-11-08 mentioning <code>\'*memo*\'</code>.'],
    ['Following the money', 'Use the kidnapper\'s <code>ROWID</code> as <code>payee_id</code> in <code>UPI_Payments</code>, keep only November, and total it per payer:<pre>' + highlight('SELECT payer_id, SUM(amount), COUNT(ROWID)\nFROM UPI_Payments\nWHERE ... \nGROUP BY payer_id') + '</pre>', 2],
    ['Organizer every time', 'Get the ROWIDs of the ReactHyderabad meetups since September, then count <code>Organizer</code> check-ins per person with <code>event_id IN (…)</code> and <code>GROUP BY</code>. Who matches the money?', 2],
  ];
  $('#hint-list').innerHTML = HINTS.map(function (h, i) {
    return '<details class="hint"><summary>Hint ' + (i + 1) + ': ' + esc(h[0]) + '<span class="hint-stage">Stage ' + (h[2] || 1) + '</span></summary><div class="hint-body">' + h[1] + '</div></details>';
  }).join('');

  // ---------- solving ----------
  function setVerdict(form, ok, html) {
    var v = form.querySelector('.verdict');
    v.className = 'verdict ' + (ok ? 'ok' : 'no');
    v.innerHTML = html;
  }
  function unlockStage2() {
    var f = $('#form-mastermind');
    f.classList.remove('locked');
    f.removeAttribute('aria-disabled');
    f.querySelectorAll('input, button').forEach(function (el) { el.disabled = false; });
  }
  function closeCase() {
    var st = document.querySelector('.stamp');
    st.textContent = 'Case closed';
    st.classList.add('closed');
  }
  document.querySelectorAll('form.solve-card').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var stage = form.dataset.stage;
      var name = form.querySelector('input').value;
      var btn = form.querySelector('button');
      btn.disabled = true;
      fetch(API + '/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: stage, name: name }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.error) return setVerdict(form, false, esc(d.error));
          if (!d.correct) return setVerdict(form, false, d.message);
          var html = '<h4>' + esc(d.title) + '</h4>' + d.body;
          setVerdict(form, true, html);
          var progress = store.get('progress', {});
          progress[stage] = { name: name, html: html };
          store.set('progress', progress);
          recordSplit(stage);
          if (stage === 'kidnapper') unlockStage2();
          if (stage === 'mastermind') closeCase();
        })
        .catch(function () { setVerdict(form, false, 'Could not reach the server. Try again.'); })
        .finally(function () { btn.disabled = false; });
    });
  });
  function restoreProgress() {
    var p = store.get('progress', {});
    ['kidnapper', 'mastermind'].forEach(function (stage) {
      if (!p[stage]) return;
      var form = $('#form-' + stage);
      form.querySelector('input').value = p[stage].name;
      setVerdict(form, true, p[stage].html);
    });
    if (p.kidnapper) unlockStage2();
    if (p.mastermind) closeCase();
  }
  $('#reset-progress').addEventListener('click', function () {
    if (!confirm('Reset your answers, timer, notebook and query history in this browser?')) return;
    ['progress', 'timer', 'notebook', 'history', 'draft'].forEach(store.del);
    location.reload();
  });

  // ---------- boot ----------
  renderLessons();
  renderHistory();
  restoreProgress();
  renderTimer();
  fetch(API + '/schema')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      renderSchema(data);
      var badge = $('#mode-badge');
      if (data.mode === 'catalyst') { badge.textContent = '● Catalyst Data Store'; badge.className = 'mode-badge live'; }
      else { badge.textContent = '● local simulator'; badge.className = 'mode-badge local'; badge.title = 'Queries run on a local SQLite copy that emulates ZCQL rules'; }
    })
    .catch(function () {
      $('#schema-list').innerHTML = '<p class="muted">Could not load the schema. Is the backend running?</p>';
      $('#mode-badge').textContent = 'offline';
    });
})();
