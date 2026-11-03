/* Application tracker: data helpers. Pure functions (no DOM, no storage) so they can be tested in Node.
 * Exposed as window.TrackerData.
 */
(function (root) {
  'use strict';

  const STATUSES = ['Wishlist', 'Applied', 'Interview', 'Assessment', 'Offer', 'Selected', 'Rejected', 'Withdrawn', 'No response'];
  const ACTIVE = ['Applied', 'Interview', 'Assessment', 'Offer'];
  const MODES = ['Remote', 'Hybrid', 'On-site'];

  const pad = function (n) { return String(n).padStart(2, '0'); };
  const iso = function (y, m, d) { return y + '-' + pad(m) + '-' + pad(d); };
  function todayISO(now) { now = now || new Date(); return iso(now.getFullYear(), now.getMonth() + 1, now.getDate()); }
  function addDays(isoDate, n) {
    const p = String(isoDate).split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2] + n);
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  const validISO = function (s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return false;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
  };
  const uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  /* ---------- status wording from free text (your Excel might say "Not selected", "Interview faced", ...) ---------- */
  function normStatus(txt) {
    const t = String(txt || '').toLowerCase().trim();
    if (!t) return null;
    if (/withdr/.test(t)) return 'Withdrawn';
    if (/no (response|reply|answer|feedback)|ghost|never heard|silent|not heard/.test(t)) return 'No response';
    if (/reject|declin|unsuccess|not (selected|shortlisted|moving|proceed|considered|hired|successful)|regret|turned down|failed|did not (get|pass)|closed/.test(t)) return 'Rejected';
    if (/offer/.test(t)) return 'Offer';
    if (/select|hired|accepted|got the job|joined|onboard|placed/.test(t)) return 'Selected';
    if (/assess|test|task|assignment|coding|challenge|exam/.test(t)) return 'Assessment';
    if (/interview|screen|call|round|\bhr\b|technical|final|face/.test(t)) return 'Interview';
    if (/wish|saved|to apply|bookmark|later|interested|todo|to-do/.test(t)) return 'Wishlist';
    if (/appl|pending|waiting|submitted|sent|in progress|open|await/.test(t)) return 'Applied';
    return null;
  }

  /* ---------- dates from spreadsheets ---------- */
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function parseDate(raw, pref) {
    let s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    if (/^\d{5}(\.\d+)?$/.test(s) && +s > 25000 && +s < 70000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 86400000);
      return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
    if (m) return validISO(iso(+m[1], +m[2], +m[3])) ? iso(+m[1], +m[2], +m[3]) : '';
    m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})\b/.exec(s);
    if (m) {
      let a = +m[1], b = +m[2], y = +m[3];
      if (y < 100) y += 2000;
      let day = a, mon = b;
      if (a > 12) { day = a; mon = b; } else if (b > 12) { day = b; mon = a; } else if (pref === 'mdy') { mon = a; day = b; }
      return validISO(iso(y, mon, day)) ? iso(y, mon, day) : '';
    }
    m = /^(\d{1,2})(?:st|nd|rd|th)?[-\s]+([a-z]{3,9})\.?,?[-\s]+(\d{2}|\d{4})\b/i.exec(s);
    if (m) { const mi = MON.indexOf(m[2].slice(0, 3).toLowerCase()); if (mi >= 0) { const y = +m[3] < 100 ? +m[3] + 2000 : +m[3]; return validISO(iso(y, mi + 1, +m[1])) ? iso(y, mi + 1, +m[1]) : ''; } }
    m = /^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i.exec(s);
    if (m) { const mi = MON.indexOf(m[1].slice(0, 3).toLowerCase()); if (mi >= 0) return validISO(iso(+m[3], mi + 1, +m[2])) ? iso(+m[3], mi + 1, +m[2]) : ''; }
    m = /^([a-z]{3,9})\.?,?\s+(\d{4})$/i.exec(s);
    if (m) { const mi = MON.indexOf(m[1].slice(0, 3).toLowerCase()); if (mi >= 0) return iso(+m[2], mi + 1, 1); }
    return '';
  }
  function detectDatePref(values) {
    let dmy = 0, mdy = 0;
    values.forEach(function (v) {
      const m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})\b/.exec(String(v || '').trim());
      if (m) { if (+m[1] > 12) dmy++; if (+m[2] > 12) mdy++; }
    });
    return mdy > dmy ? 'mdy' : 'dmy';
  }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const count = function (line, c) { let n = 0, q = false; for (let i = 0; i < line.length; i++) { if (line[i] === '"') q = !q; else if (!q && line[i] === c) n++; } return n; };
    let delim = ',', best = -1;
    [',', ';', '\t'].forEach(function (c) { const n = count(first, c); if (n > best) { best = n; delim = c; } });
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
      else f += ch;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }
  function toCSV(rows) {
    const cell = function (v) {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n');
  }

  const HEAD = ['Company', 'Role', 'Status', 'Date applied', 'Follow-up', 'Location', 'Work mode', 'Salary', 'Source', 'Link', 'Fit %', 'CV version', 'Notes'];
  function exportRows(items) {
    return [HEAD].concat(items.map(function (i) {
      return [i.company, i.role, i.status, i.applied, i.followUp, i.location, i.mode, i.salary, i.source, i.link, i.fit == null ? '' : i.fit, i.cvName, i.notes];
    }));
  }

  /* ---------- importing someone's existing sheet ---------- */
  const FIELDS = {
    company: ['company', 'companyname', 'employer', 'organisation', 'organization', 'firm', 'client'],
    role: ['role', 'position', 'jobtitle', 'title', 'job', 'designation', 'vacancy', 'jobrole', 'positionapplied', 'jobposition'],
    status: ['status', 'stage', 'result', 'outcome', 'applicationstatus', 'currentstatus', 'progress'],
    applied: ['dateapplied', 'applieddate', 'appliedon', 'applicationdate', 'date', 'applied', 'dateofapplication'],
    followUp: ['followup', 'followupdate', 'nextstep', 'nextstepdate', 'nextaction', 'reminder'],
    link: ['link', 'url', 'joburl', 'joblink', 'posting', 'postinglink', 'applicationlink', 'website', 'jobposting'],
    location: ['location', 'city', 'country', 'place', 'joblocation'],
    mode: ['workmode', 'mode', 'worktype', 'remote', 'worksetup', 'setup', 'arrangement'],
    salary: ['salary', 'pay', 'compensation', 'expectedsalary', 'ctc', 'package', 'salaryrange', 'offeredsalary'],
    source: ['source', 'platform', 'portal', 'site', 'via', 'jobboard', 'foundon', 'appliedvia', 'appliedthrough'],
    notes: ['notes', 'note', 'comments', 'comment', 'remarks', 'feedback', 'details']
  };
  const CONTAINS = [['company', /company|employer|organi[sz]ation/], ['role', /title|position|designation|role/], ['status', /status|stage|outcome|result/], ['followUp', /follow/], ['applied', /appl.*date|date.*appl|applied/], ['link', /link|url/], ['salary', /salary|pay|ctc|compensation/], ['location', /location|city/], ['source', /source|platform|portal/], ['notes', /note|comment|remark|feedback/]];
  const key = function (h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };

  function mapColumns(header) {
    const map = {}, used = new Set();
    header.forEach(function (h, i) {
      const k = key(h);
      for (const f in FIELDS) { if (!(f in map) && FIELDS[f].indexOf(k) >= 0) { map[f] = i; used.add(i); break; } }
    });
    header.forEach(function (h, i) {
      if (used.has(i)) return;
      const k = String(h || '').toLowerCase();
      for (let j = 0; j < CONTAINS.length; j++) { if (!(CONTAINS[j][0] in map) && CONTAINS[j][1].test(k)) { map[CONTAINS[j][0]] = i; used.add(i); break; } }
    });
    return { map: map, unmapped: header.map(function (h, i) { return i; }).filter(function (i) { return !used.has(i) && String(header[i] || '').trim(); }) };
  }

  /* Turns parsed CSV rows into application records. Returns the records plus what was matched, so the user can check it. */
  function importRows(rows, existing, now) {
    if (!rows.length) return { items: [], mapping: {}, unmapped: [], skipped: 0, problems: ['The file is empty.'] };
    const header = rows[0], body = rows.slice(1);
    const cm = mapColumns(header), map = cm.map;
    const problems = [];
    if (!('company' in map) && !('role' in map)) problems.push('No Company or Role column was found in the first row.');
    const pref = detectDatePref(body.map(function (r) { return 'applied' in map ? r[map.applied] : ''; }));
    const seen = new Set((existing || []).map(function (i) { return dedupeKey(i); }));
    const today = todayISO(now);
    const items = []; let skipped = 0, blank = 0;
    body.forEach(function (r) {
      const g = function (f) { return f in map ? String(r[map[f]] == null ? '' : r[map[f]]).replace(/^'(?=[=+\-@])/, '').trim() : ''; };
      const company = g('company'), role = g('role');
      if (!company && !role) { blank++; return; }
      const notes = [];
      if (g('notes')) notes.push(g('notes'));
      cm.unmapped.forEach(function (i) { const v = String(r[i] == null ? '' : r[i]).trim(); if (v) notes.push(String(header[i]).trim() + ': ' + v); });
      let status = normStatus(g('status'));
      if (g('status') && !status) notes.push('Original status: ' + g('status'));
      status = status || 'Applied';
      const applied = parseDate(g('applied'), pref);
      if (g('applied') && !applied) notes.push('Original date: ' + g('applied'));
      const follow = parseDate(g('followUp'), pref);
      let mode = g('mode');
      const mm = MODES.filter(function (x) { return x.toLowerCase() === mode.toLowerCase() || mode.toLowerCase().replace(/[^a-z]/g, '') === x.toLowerCase().replace(/[^a-z]/g, ''); })[0];
      if (mode && !mm) { notes.push('Work mode: ' + mode); mode = ''; } else mode = mm || '';
      const it = {
        id: uid() + items.length, company: company, role: role, status: status, applied: applied || (status === 'Wishlist' ? '' : today), link: g('link'), location: g('location'), mode: mode,
        salary: g('salary'), source: g('source'), followUp: follow, notes: notes.join('\n'), jd: '', cvId: null, cvName: '', fit: null, created: today, history: []
      };
      it.history = [{ s: status, d: it.applied || today }];
      const k = dedupeKey(it);
      if (seen.has(k)) { skipped++; return; }
      seen.add(k); items.push(it);
    });
    const names = {};
    Object.keys(map).forEach(function (f) { names[f] = header[map[f]]; });
    return { items: items, mapping: names, unmapped: cm.unmapped.map(function (i) { return header[i]; }), skipped: skipped, blank: blank, problems: problems, datePref: pref };
  }
  const dedupeKey = function (i) { return [i.company, i.role, i.applied].map(function (x) { return String(x || '').toLowerCase().trim(); }).join('|'); };

  /* ---------- list helpers ---------- */
  function stats(items) {
    const applied = items.filter(function (i) { return i.status !== 'Wishlist'; });
    const ever = function (i, set) { return set.indexOf(i.status) >= 0 || (i.history || []).some(function (h) { return set.indexOf(h.s) >= 0; }); };
    const n = function (set) { return applied.filter(function (i) { return ever(i, set); }).length; };
    return {
      total: items.length, applied: applied.length,
      active: items.filter(function (i) { return ACTIVE.indexOf(i.status) >= 0; }).length,
      wishlist: items.length - applied.length,
      interviews: n(['Interview', 'Assessment', 'Offer', 'Selected']),
      offers: n(['Offer', 'Selected']),
      selected: applied.filter(function (i) { return i.status === 'Selected'; }).length,
      rejected: applied.filter(function (i) { return i.status === 'Rejected'; }).length,
      responded: n(['Interview', 'Assessment', 'Offer', 'Selected', 'Rejected'])
    };
  }
  function filterItems(items, o) {
    const q = String((o && o.q) || '').toLowerCase().trim();
    return items.filter(function (i) {
      if (o && o.status && o.status !== 'All') {
        if (o.status === 'Active') { if (ACTIVE.indexOf(i.status) < 0) return false; }
        else if (i.status !== o.status) return false;
      }
      return !q || [i.company, i.role, i.location, i.source, i.notes, i.status].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sortItems(items, how) {
    const a = items.slice();
    const by = {
      newest: function (x, y) { return (y.applied || y.created || '').localeCompare(x.applied || x.created || '') || (y.created || '').localeCompare(x.created || ''); },
      oldest: function (x, y) { return (x.applied || x.created || '').localeCompare(y.applied || y.created || ''); },
      company: function (x, y) { return String(x.company).localeCompare(String(y.company)); },
      status: function (x, y) { return STATUSES.indexOf(x.status) - STATUSES.indexOf(y.status); },
      fit: function (x, y) { return (y.fit == null ? -1 : y.fit) - (x.fit == null ? -1 : x.fit); },
      followup: function (x, y) { return (x.followUp || '9999').localeCompare(y.followUp || '9999'); }
    };
    return a.sort(by[how] || by.newest);
  }
  /* 'overdue' | 'today' | 'soon' | '' for the follow-up chip */
  function followState(i, now) {
    if (!i.followUp || ACTIVE.indexOf(i.status) < 0) return '';
    const t = todayISO(now);
    return i.followUp < t ? 'overdue' : i.followUp === t ? 'today' : '';
  }
  function setStatus(item, status, date) {
    if (item.status === status) return false;
    item.status = status;
    item.history = (item.history || []).concat([{ s: status, d: date || todayISO() }]);
    return true;
  }
  /* Fills missing fields and fixes types in a loaded tracker, so old or hand-edited backups never break the UI. */
  function fixTracker(t) {
    if (!t || !Array.isArray(t.items)) return { v: 1, items: [] };
    t.items = t.items.filter(function (i) { return i && typeof i === 'object'; }).map(function (i) {
      const o = Object.assign({ id: uid(), company: '', role: '', status: 'Applied', applied: '', link: '', location: '', mode: '', salary: '', source: '', followUp: '', notes: '', jd: '', cvId: null, cvName: '', fit: null, created: '', history: [] }, i);
      if (STATUSES.indexOf(o.status) < 0) o.status = normStatus(o.status) || 'Applied';
      if (!Array.isArray(o.history)) o.history = [];
      return o;
    });
    t.v = 1;
    return t;
  }

  root.TrackerData = {
    STATUSES: STATUSES, ACTIVE: ACTIVE, MODES: MODES, normStatus: normStatus, parseDate: parseDate, detectDatePref: detectDatePref,
    parseCSV: parseCSV, toCSV: toCSV, exportRows: exportRows, mapColumns: mapColumns, importRows: importRows, dedupeKey: dedupeKey,
    stats: stats, filterItems: filterItems, sortItems: sortItems, followState: followState, setStatus: setStatus, fixTracker: fixTracker,
    todayISO: todayISO, addDays: addDays, validISO: validISO, uid: uid
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TrackerData;
})(typeof window !== 'undefined' ? window : globalThis);
