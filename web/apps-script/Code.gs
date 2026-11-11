/**
 * Receives pilot results from the pilot page (web/src/beta/pilot.ts) and
 * writes them to the Google Sheet this script is bound to.
 *
 * Setup: docs/pilot-hosting.md. In short: open the team's Google Sheet,
 * Extensions > Apps Script, paste this file, Deploy > New deployment >
 * Web app, Execute as: Me, Who has access: Anyone. Give the web app URL to
 * the pilot build as VITE_RESULTS_URL.
 *
 * Two tabs are created on first use:
 *   trials  one row per test trial. Same columns as the beta page's raw CSV,
 *           so a CSV download of this tab can be imported into the beta
 *           page's item analysis.
 *   runs    one row per finished test, with the scores the page computed.
 *
 * The web app URL is public, so anyone who finds it could send fake rows.
 * Every request is checked here, but the data still needs screening before
 * analysis (for example, runs with very fast RTs or no participant code).
 */

var TRIAL_COLUMNS = [
  'run_id', 'created_at', 'label', 'set', 'bank_set', 'position', 'item_id', 'lexicality', 'item_type',
  'response', 'correct', 'rt_ms', 'source', 'participant_code',
];
var RUN_COLUMNS = [
  'run_id', 'created_at', 'received_at', 'label', 'participant_code', 'set', 'bank_set', 'consent_version',
  'n_trials', 'avg_pct', 'real_pct', 'pseudo_pct', 'ghent', 'd_prime', 'mean_rt_correct_ms', 'user_agent',
];
var MAX_TRIALS = 300;

function doGet() {
  return json_({ ok: true, info: 'LexTALE pilot results endpoint. Send results with POST.' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }
  try {
    var body = JSON.parse(e.postData.contents);
    var problem = validate_(body);
    if (problem) return json_({ ok: false, error: problem });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var runs = sheet_(ss, 'runs', RUN_COLUMNS);
    var trials = sheet_(ss, 'trials', TRIAL_COLUMNS);
    var run = body.run;

    // The page may send the same run twice (retry); keep only the first.
    var found = runs.getRange('A:A').createTextFinder(run.run_id).matchEntireCell(true).findNext();
    if (found) return json_({ ok: true, duplicate: true });

    var now = new Date().toISOString();
    var rows = body.trials.map(function (t) {
      return [run.run_id, run.created_at, run.label, run.set, run.bank_set, t.position, t.item_id, t.lexicality,
        t.item_type, t.response, t.correct, t.rt_ms, t.source, run.participant_code].map(safe_);
    });
    trials.getRange(trials.getLastRow() + 1, 1, rows.length, TRIAL_COLUMNS.length).setValues(rows);
    runs.appendRow([run.run_id, run.created_at, now, run.label, run.participant_code, run.set, run.bank_set,
      run.consent_version, run.n_trials, run.avg_pct, run.real_pct, run.pseudo_pct, run.ghent, run.d_prime,
      run.mean_rt_correct_ms, run.user_agent].map(safe_));
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function validate_(b) {
  if (!b || b.v !== 1 || !b.run || !Array.isArray(b.trials)) return 'bad format';
  var r = b.run;
  if (!/^[0-9A-Za-z-]{8,40}$/.test(r.run_id || '')) return 'bad run_id';
  if (!/^[A-Za-z0-9_-]{0,20}$/.test(r.label || '')) return 'bad label';
  if (!/^[A-Za-z0-9_-]{0,20}$/.test(r.participant_code || '')) return 'bad participant_code';
  if (b.trials.length < 1 || b.trials.length > MAX_TRIALS) return 'bad number of trials';
  for (var i = 0; i < b.trials.length; i++) {
    var t = b.trials[i];
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(t.item_id || '')) return 'bad item_id';
    if (t.response !== 'yes' && t.response !== 'no') return 'bad response';
    if (typeof t.rt_ms !== 'number' || t.rt_ms < 0 || t.rt_ms > 600000) return 'bad rt_ms';
  }
  return '';
}

/** Returns the tab, creating it with a header row if needed. */
function sheet_(ss, name, columns) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(columns);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Text values that start like a formula are stored as plain text. */
function safe_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') {
    v = v.slice(0, 300);
    if (/^[=+\-@]/.test(v)) return "'" + v;
  }
  return v;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
