/* Browser-local records. No account or server leaderboard. */
window.MemoRecords = (function () {
  'use strict';
  var connection;
  var listeners = new Set();
  var channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('memo-detective-records') : null;
  function notify() { listeners.forEach(function (listener) { listener(); }); }
  if (channel) channel.onmessage = notify;
  function subscribe(listener) {
    listeners.add(listener);
    return function () { listeners.delete(listener); };
  }
  function open() {
    if (connection) return connection;
    connection = new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('IndexedDB is unavailable.'));
      var request = indexedDB.open('memo-detective-bureau', 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains('rounds')) db.createObjectStore('rounds', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };
      request.onsuccess = function () {
        var db = request.result;
        db.onversionchange = function () { db.close(); connection = null; };
        db.onclose = function () { connection = null; };
        resolve(db);
      };
      request.onerror = function () { connection = null; reject(request.error); };
      request.onblocked = function () { connection = null; reject(new Error('Close older game tabs to open the leaderboard.')); };
    });
    connection = connection.catch(function (error) { connection = null; throw error; });
    return connection;
  }
  function shuffle(items) {
    var copy = items.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = copy[i]; copy[i] = copy[j]; copy[j] = temp;
    }
    return copy;
  }
  async function nextCase(ids) {
    var db = await open();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('settings', 'readwrite');
      var object = tx.objectStore('settings');
      var request = object.get('case-queue');
      var chosen;
      request.onsuccess = function () {
        var saved = request.result;
        var queue = saved ? saved.queue.filter(function (id) { return ids.indexOf(id) >= 0; }) : [];
        if (!queue.length) {
          queue = shuffle(ids);
          if (saved && queue.length > 1 && queue[0] === saved.last) queue.push(queue.shift());
        }
        chosen = queue.shift();
        object.put({ key: 'case-queue', queue: queue, last: chosen });
      };
      tx.oncomplete = function () { resolve(chosen); };
      tx.onerror = tx.onabort = function () { reject(tx.error || new Error('Could not rotate cases.')); };
    });
  }
  async function save(round) {
    var db = await open();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('rounds', 'readwrite');
      tx.objectStore('rounds').put(round);
      tx.oncomplete = function () {
        // Refresh views only after IndexedDB has committed the score.
        notify();
        if (channel) channel.postMessage('scores-changed');
        resolve();
      };
      tx.onerror = tx.onabort = function () { reject(tx.error || new Error('Could not save the score.')); };
    });
  }
  async function list() {
    var db = await open();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('rounds', 'readonly');
      var request = tx.objectStore('rounds').getAll();
      tx.oncomplete = function () { resolve(request.result.sort(function (a, b) { return b.score - a.score || a.elapsed - b.elapsed || a.finished - b.finished; })); };
      tx.onerror = tx.onabort = function () { reject(tx.error || new Error('Could not read the scores.')); };
    });
  }
  async function topScores() {
    return (await list()).slice(0, 10);
  }
  return { nextCase: nextCase, save: save, list: list, topScores: topScores, subscribe: subscribe, shuffle: shuffle };
})();
