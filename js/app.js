/* App wiring: navigation, builder buttons, backup and restore, start-up. */

function showView(v) {
  if (v !== 'builder' && v !== 'tracker') v = 'builder';
  document.body.dataset.view = v;
  $('#view-builder').hidden = v !== 'builder';
  $('#view-tracker').hidden = v !== 'tracker';
  $$('.views button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  lsSet(KEYS.view, v);
  if (v === 'tracker') { renderTracker(); document.title = 'Applications - Job Hunter'; }
  else pv();
  window.scrollTo(0, 0);
}

/* ---------- Typing in the editor ---------- */
document.addEventListener('input', e => {
  const p = e.target.dataset && e.target.dataset.p; if (!p) return;
  set(p, e.target.type == 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value);
  save(); pv();
});

/* ---------- Clicks ---------- */
document.addEventListener('click', e => {
  const vw = e.target.closest('.views [data-view]'); if (vw) { showView(vw.dataset.view); return; }
  const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; pv(); return; }
  const a = e.target.closest('[data-a]');
  if (a) {
    const [act, k, n] = a.dataset.a.split(':'), i = +n, arr = D()[k], st = snap(), key = j => k + '.' + j, len = arr.length;
    let focus = null;
    if (act == 'add') { arr.push(clone(NEW[k])); st.it[key(len)] = true; focus = `[data-k="${key(len)}"] input:not([type=checkbox])`; }
    if (act == 'rm' && confirm('Remove this item?')) {
      arr.splice(i, 1);
      for (let j = i; j < len - 1; j++) st.it[key(j)] = st.it[key(j + 1)];
      delete st.it[key(len - 1)];
    }
    if (act == 'up' && i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];[st.it[key(i - 1)], st.it[key(i)]] = [st.it[key(i)], st.it[key(i - 1)]]; focus = `[data-a="up:${k}:${i - 1}"]`; }
    if (act == 'dn' && i < len - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];[st.it[key(i + 1)], st.it[key(i)]] = [st.it[key(i)], st.it[key(i + 1)]]; focus = `[data-a="dn:${k}:${i + 1}"]`; }
    save(); ed(st); pv();
    if (focus) { const el = document.querySelector(focus); if (el) el.focus(); }
    return;
  }
  const g = e.target.closest('[data-g]'); if (!g) return;
  const c = cur(), act = g.dataset.g;
  if (act == 'print') window.print();
  if (act == 'applied') openApplied();
  if (act == 'new') {
    const n = prompt('Name this version (e.g. Acme - Backend Engineer):'); if (!n) return;
    const id = Date.now(); V.list.push({ id, name: n, data: clone(c.data) }); V.cur = id; save(); vers(); ed(); pv();
  }
  if (act == 'blank') {
    const n = prompt('Name the blank version:'); if (!n) return;
    const id = Date.now(); V.list.push({ id, name: n, data: clone(EMPTY) }); V.cur = id; save(); vers(); ed(); pv();
  }
  if (act == 'ren') { const n = prompt('New name:', c.name); if (n) { c.name = n; save(); vers(); } }
  if (act == 'del') {
    if (V.list.length < 2) return alert('You need at least one version.');
    if (confirm('Delete "' + c.name + '"?')) { V.list = V.list.filter(v => v.id != c.id); V.cur = V.list[0].id; save(); vers(); ed(); pv(); updateApplyBtn(); }
  }
  if (act == 'copytxt') copyText(Analyzer.cvPlain(c.data)).then(() => toast('CV copied as plain text.'), () => toast('Could not copy. Your browser blocked clipboard access.'));
  if (act == 'detect') {
    const d = D();
    if (!d.jd.trim()) { toast('Paste the job description first.'); return; }
    const j = Analyzer.detectJob(d.jd);
    let n = 0;
    [['cl.company', j.company, d.cl.company], ['cl.role', j.role, d.cl.role], ['job.link', j.link, d.job.link], ['job.location', j.location, d.job.location], ['job.mode', j.mode, d.job.mode], ['job.salary', j.salary, d.job.salary], ['job.source', j.source, d.job.source]]
      .forEach(x => { if (x[1] && !x[2]) { set(x[0], x[1]); n++; } });
    if (n) { save(); ed(snap()); pv(); }
    toast(n ? 'Filled ' + n + ' empty field' + (n > 1 ? 's' : '') + ' from the description. Please check them.' : 'Nothing new to fill. The fields are already set, or the text does not mention them.');
  }
  if (act == 'exp') {
    download(new Blob([JSON.stringify({ app: 'job-hunter', v: 2, exported: new Date().toISOString(), cv: V, tracker: TR }, null, 1)], { type: 'application/json' }), 'job-hunter-backup-' + TD.todayISO() + '.json');
    toast('Backup downloaded. It has your CVs and applications, not your API key.');
  }
  if (act == 'imp') $('#file').click();
  if (act == 'csvx') exportCSV();
  if (act == 'csvi') $('#csvfile').click();
  if (act == 'ai-set') openAISettings();
  if (act == 'ai-run') runAI();
  if (act == 'ai-prompt') copyAIPrompt();
});

$('#ver').addEventListener('change', e => { V.cur = +e.target.value; save(); ed(); pv(); });

/* ---------- Restore ---------- */
$('#file').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const input = e.target;
  f.text().then(t => {
    let j = null; try { j = JSON.parse(t); } catch (x) { /* handled below */ }
    const cvPart = j && (Array.isArray(j.list) ? j : (j.cv && Array.isArray(j.cv.list) ? j.cv : null));
    const cv2 = cvPart ? fixCVStore(clone(cvPart)) : null;
    const trPart = j && j.tracker && Array.isArray(j.tracker.items) ? j.tracker : null;
    if (!cv2 && !trPart) { alert('That file is not a Job Hunter or CV Builder backup.'); input.value = ''; return; }
    const parts = []; if (cv2) parts.push(cv2.list.length + ' CV version' + (cv2.list.length === 1 ? '' : 's')); if (trPart) parts.push(trPart.items.length + ' application' + (trPart.items.length === 1 ? '' : 's'));
    if (confirm('This backup has ' + parts.join(' and ') + '. Replace what you have now with it? Anything not in the backup will be lost.')) {
      if (cv2) { V = cv2; save(); }
      if (trPart) { TR = TD.fixTracker(clone(trPart)); saveT(); }
      vers(); ed(); pv(); renderTracker(); updateApplyBtn(); toast('Backup restored.');
    }
    input.value = '';
  }, () => { alert('Could not read that file.'); input.value = ''; });
});

/* ---------- Menus ---------- */
document.addEventListener('click', e => { $$('.menu[open]').forEach(m => { if (!m.contains(e.target) || e.target.closest('.pop button')) m.open = false; }); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.menu[open]').forEach(m => m.open = false); });

/* ---------- Start ---------- */
vers(); ed(); pv(); renderTracker();
showView(lsGet(KEYS.view) === 'tracker' ? 'tracker' : 'builder');
