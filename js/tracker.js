/* Applications view: list, filters, stats, add/edit dialog, CSV import and export, and the "Mark as applied" flow. */

let TF = { q: '', status: 'All', sort: 'newest' };
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = s => TD.validISO(s) ? (+s.slice(8) + ' ' + MONS[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4)) : '';
const slug = s => 's-' + String(s).toLowerCase().replace(/[^a-z]/g, '');
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '0%';

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Rendering ---------- */
function renderStats() {
  const s = TD.stats(TR.items);
  const tile = (n, l, sub) => `<div class="stat"><b>${n}</b><span>${l}</span><small>${sub}</small></div>`;
  $('#t-stats').innerHTML =
    tile(s.applied, 'Applied', s.wishlist ? s.wishlist + ' on your wishlist' : 'jobs sent') +
    tile(s.active, 'In progress', 'still open') +
    tile(s.interviews, 'Interviews', pct(s.interviews, s.applied) + ' of applied') +
    tile(s.offers, 'Offers', s.selected + ' selected') +
    tile(s.rejected, 'Rejected', pct(s.rejected, s.applied) + ' of applied');
}
function renderChips() {
  const n = st => TR.items.filter(i => i.status === st).length;
  const active = TR.items.filter(i => TD.ACTIVE.indexOf(i.status) >= 0).length;
  const chips = [['All', TR.items.length], ['Active', active]].concat(TD.STATUSES.map(s => [s, n(s)]).filter(x => x[1] > 0));
  if (!chips.some(c => c[0] === TF.status)) TF.status = 'All';
  $('#t-chips').innerHTML = chips.map(c => `<button class="fchip" data-tr="chip" data-v="${esc(c[0])}" aria-pressed="${TF.status === c[0]}">${esc(c[0])}<i>${c[1]}</i></button>`).join('');
}
function rowHTML(i) {
  const cvOK = i.cvId != null && V.list.some(v => v.id == i.cvId);
  const link = urlOf(i.link);
  const fs = TD.followState(i);
  const fu = i.followUp && TD.ACTIVE.indexOf(i.status) >= 0
    ? (fs === 'overdue' ? '<span class="fu over">Overdue</span>' : fs === 'today' ? '<span class="fu today">Today</span>' : '') + '<small>' + esc(fmtDate(i.followUp)) + '</small>'
    : '–';
  const id = esc(i.id);
  return `<tr>
<td class="cm" data-l="Job"><button class="lk" data-tr="edit" data-id="${id}"><b>${esc(i.company || 'Untitled company')}</b><span>${esc(i.role || 'No job title')}</span></button></td>
<td data-l="Status"><select class="stsel ${slug(i.status)}" data-tr="status" data-id="${id}" aria-label="Status for ${esc(i.company || 'this application')}">${TD.STATUSES.map(s => `<option${s === i.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
<td class="nw" data-l="Applied">${esc(fmtDate(i.applied)) || '–'}</td>
<td data-l="Location">${esc(i.location) || '–'}${i.mode ? `<small>${esc(i.mode)}</small>` : ''}</td>
<td class="num" data-l="Fit">${i.fit == null ? '–' : i.fit + '%'}</td>
<td data-l="Follow-up">${fu}</td>
<td class="ra">${link ? `<a href="${esc(link.href)}" target="_blank" rel="noopener noreferrer">Posting</a>` : ''}${cvOK ? `<button data-tr="cv" data-cv="${esc(i.cvId)}">Open CV</button>` : ''}<button data-tr="edit" data-id="${id}">Edit</button></td>
</tr>`;
}
function renderList() {
  const rows = TD.sortItems(TD.filterItems(TR.items, TF), TF.sort);
  $('#t-list').innerHTML = rows.length
    ? `<table class="tt"><thead><tr><th>Job</th><th>Status</th><th>Applied</th><th>Location</th><th>Fit</th><th>Follow-up</th><th><span class="sr">Actions</span></th></tr></thead><tbody>${rows.map(rowHTML).join('')}</tbody></table>`
    : '<div class="none">No applications match your search or filter.</div>';
}
function renderTracker() {
  const n = TR.items.length;
  $('#tcount').textContent = n;
  $('#t-empty').hidden = n > 0;
  $('#t-main').hidden = n === 0;
  $('#t-actions').hidden = n === 0 ? true : false;
  if (n) { renderStats(); renderChips(); renderList(); }
}
/* Is this job already in the tracker? Matched by link, or by company and job title. */
const lc = s => String(s || '').trim().toLowerCase();
const sameJob = (i, r) => {
  if (lc(r.link) && lc(i.link) === lc(r.link)) return true;
  return !!(lc(r.company) || lc(r.role)) && lc(i.company) === lc(r.company) && lc(i.role) === lc(r.role);
};
const trackedNow = () => { const d = D(); return TR.items.find(i => sameJob(i, { company: d.cl.company, role: d.cl.role, link: d.job.link })); };
function updateApplyBtn() {
  const b = $('#applybtn');
  if (!b) return;
  b.lastElementChild.textContent = trackedNow() ? 'Update application' : 'Mark as applied';
}

/* ---------- Add / edit dialog (also used by "Mark as applied") ---------- */
function currentFit(jd) {
  return String(jd || '').trim() ? Analyzer.analyze(Object.assign({}, D(), { jd: jd })).overall : null;
}
function openApp(id, prefill, opts) {
  opts = opts || {};
  const ex = id ? TR.items.find(i => i.id === id) : null;
  const today = TD.todayISO();
  const it = Object.assign({ company: '', role: '', status: 'Applied', applied: today, followUp: '', location: '', mode: '', salary: '', source: '', link: '', notes: '', jd: '' }, ex || {}, prefill || {});
  const cvOK = ex && ex.cvId != null && V.list.some(v => v.id == ex.cvId);
  let html = `<div class="g2">${fld('company', 'Company', it.company)}${fld('role', 'Job title', it.role)}</div>
<div class="g2">${fld('status', 'Status', it.status, { sel: TD.STATUSES.map(s => [s, s]) })}${fld('applied', 'Date applied', it.applied, { type: 'date' })}</div>
<div class="g2">${fld('followUp', 'Follow up on', it.followUp, { type: 'date' })}${fld('mode', 'Work mode', it.mode, { sel: [['', 'Not set']].concat(TD.MODES.map(m => [m, m])) })}</div>
<div class="g2">${fld('location', 'Location', it.location)}${fld('salary', 'Salary', it.salary)}</div>
<div class="g2">${fld('source', 'Found on', it.source)}${fld('link', 'Job link', it.link, { type: 'url', ph: 'https://' })}</div>
${fld('notes', 'Notes (contacts, interview dates, feedback)', it.notes, { area: 3 })}
<details><summary>Job description${it.jd ? '' : ' (none saved)'}</summary>${fld('jd', '', it.jd, { area: 8 })}</details>`;
  if (ex && ex.cvName) html += `<div class="metaln"><span>CV used: <b>${esc(ex.cvName)}</b></span>${ex.fit != null ? `<span>Fit when saved: <b>${ex.fit}%</b></span>` : ''}${cvOK ? `<button data-tr="cv" data-cv="${esc(ex.cvId)}">Open this CV</button>` : '<span>That CV version no longer exists.</span>'}</div>`;
  if (ex && ex.history.length) html += `<details><summary>Status history (${ex.history.length})</summary><ul class="hist">${ex.history.slice().reverse().map(h => `<li><b>${esc(fmtDate(h.d) || h.d)}</b><span>${esc(h.s)}</span></li>`).join('')}</ul></details>`;
  if (opts.builder && !ex) {
    const linked = TR.items.find(i => i.cvId != null && i.cvId == V.cur);
    html += `<label class="chkrow"><input type="checkbox" name="snap"${linked ? ' checked' : ''}><span>Keep a copy of this CV as a new version, so you can reopen exactly what you sent.${linked ? ' This version is already linked to <b>' + esc(linked.company || 'another job') + '</b>, so a copy is recommended.' : ''}</span></label>`;
  }
  html += '<p class="ferr" role="alert"></p>';

  const actions = [];
  if (ex) actions.push({
    label: 'Delete', cls: 'danger left', fn: () => {
      if (!confirm('Delete this application? This cannot be undone.')) return false;
      TR.items = TR.items.filter(i => i.id !== ex.id); saveT(); renderTracker(); updateApplyBtn(); toast('Application deleted.');
    }
  });
  actions.push({ label: 'Cancel' });
  actions.push({
    label: ex ? 'Save changes' : opts.builder ? 'Save to applications' : 'Add application', cls: 'p', fn: m => {
      const g = n => mval(m, n);
      const company = g('company'), role = g('role');
      if (!company && !role) { m.querySelector('.ferr').textContent = 'Add a company or a job title.'; return false; }
      const status = g('status');
      const applied = g('applied') || (status === 'Wishlist' ? '' : today);
      const rec = { company: company, role: role, applied: applied, followUp: g('followUp'), location: g('location'), mode: g('mode'), salary: g('salary'), source: g('source'), link: g('link'), notes: g('notes'), jd: g('jd') };
      if (!ex) {
        const same = TR.items.some(i => i.company.toLowerCase() === company.toLowerCase() && i.role.toLowerCase() === role.toLowerCase());
        if (same && !confirm('You already have an application for ' + (company || 'this company') + ' – ' + (role || 'this role') + '. Save another entry anyway?')) return false;
      }
      let item = ex;
      if (ex) { Object.assign(ex, rec); TD.setStatus(ex, status); }
      else { item = Object.assign({ id: TD.uid(), status: status, created: today, cvId: null, cvName: '', fit: null, history: [{ s: status, d: applied || today }] }, rec); TR.items.unshift(item); }
      let snapName = '';
      if (opts.builder) {
        syncBuilder(rec);
        item.fit = currentFit(rec.jd);
        const box = m.querySelector('[name=snap]');
        if (!ex && box && box.checked) {
          const id = Date.now();
          snapName = [company, role].filter(Boolean).join(' - ') || 'Applied CV';
          V.list.push({ id: id, name: snapName, data: clone(D()) });
          item.cvId = id; item.cvName = snapName; save(); vers();
        } else if (!item.cvId || !V.list.some(v => v.id == item.cvId)) { item.cvId = V.cur; item.cvName = cur().name; }
      }
      saveT(); renderTracker(); updateApplyBtn();
      toast((ex ? 'Application updated.' : 'Saved to Applications.') + (snapName ? ' A copy of this CV was kept as "' + snapName + '".' : ''), { label: 'View', fn: () => showView('tracker') });
    }
  });
  openModal({ title: ex ? (opts.builder ? 'Update application' : 'Edit application') : opts.builder ? 'Save to applications' : 'Add application', html: html, actions: actions, wide: true });
}
/* Keep the CV builder's job fields in step with what was confirmed in the dialog. */
function syncBuilder(r) {
  const d = D();
  d.cl.company = r.company; d.cl.role = r.role; d.jd = r.jd;
  d.job.link = r.link; d.job.location = r.location; d.job.mode = r.mode; d.job.salary = r.salary; d.job.source = r.source;
  save(); ed(snap()); pv();
}
function openApplied() {
  const d = D();
  const j = Analyzer.detectJob(d.jd), today = TD.todayISO();
  const pre = { company: d.cl.company || j.company, role: d.cl.role || j.role, link: d.job.link || j.link, location: d.job.location || j.location, mode: d.job.mode || j.mode, salary: d.job.salary || j.salary, source: d.job.source || j.source, jd: d.jd };
  const ex = TR.items.find(i => sameJob(i, pre));
  if (ex) Object.keys(pre).forEach(k => { if (!pre[k]) delete pre[k]; });
  else { pre.status = 'Applied'; pre.applied = today; pre.followUp = TD.addDays(today, 7); }
  openApp(ex ? ex.id : null, pre, { builder: true });
}
function openCV(cvId) {
  closeModal();
  const v = V.list.find(x => x.id == cvId);
  if (!v) { toast('That CV version no longer exists.'); return; }
  V.cur = v.id; save(); tab = 'cv'; showView('builder'); vers(); ed(); pv();
}

/* ---------- CSV ---------- */
const FIELD_LABEL = { company: 'Company', role: 'Job title', status: 'Status', applied: 'Date applied', followUp: 'Follow-up', link: 'Link', location: 'Location', mode: 'Work mode', salary: 'Salary', source: 'Found on', notes: 'Notes' };
function exportCSV() {
  if (!TR.items.length) { toast('No applications to export yet.'); return; }
  download(new Blob([TD.toCSV(TD.exportRows(TD.sortItems(TR.items, 'newest')))], { type: 'text/csv;charset=utf-8' }), 'job-hunter-applications-' + TD.todayISO() + '.csv');
  toast('Exported. Open the file in Excel or Google Sheets.');
}
function importFile(file) {
  file.text().then(t => showImport(TD.importRows(TD.parseCSV(t), TR.items)), () => toast('Could not read that file.'));
}
function showImport(r) {
  const n = r.items.length;
  const by = {}; r.items.forEach(i => { by[i.status] = (by[i.status] || 0) + 1; });
  let html = '<div class="imp">';
  r.problems.forEach(p => { html += `<p class="ferr">${esc(p)}</p>`; });
  html += `<p><b>${n}</b> application${n === 1 ? '' : 's'} ready to import${r.skipped ? `, ${r.skipped} skipped as duplicates` : ''}${r.blank ? `, ${r.blank} empty row${r.blank === 1 ? '' : 's'} ignored` : ''}.</p>`;
  if (Object.keys(r.mapping).length) {
    html += '<p class="mn">How your columns were read. Check these before importing:</p><table><tr><th>In Job Hunter</th><th>Your column</th></tr>' + Object.keys(r.mapping).map(f => `<tr><td>${FIELD_LABEL[f] || esc(f)}</td><td>${esc(r.mapping[f])}</td></tr>`).join('') + '</table>';
    if (r.unmapped.length) html += `<p class="mn">Other columns are added to each application's notes: ${r.unmapped.map(esc).join(', ')}.</p>`;
    if (r.mapping.applied) html += `<p class="mn">Dates like 03/04/2026 were read as ${r.datePref === 'mdy' ? 'month/day/year' : 'day/month/year'}.</p>`;
  }
  if (n) {
    html += '<p class="mn">Statuses: ' + Object.keys(by).map(s => `${esc(s)} ${by[s]}`).join(', ') + '.</p>';
    html += '<table><tr><th>Company</th><th>Job title</th><th>Status</th><th>Applied</th></tr>' + r.items.slice(0, 5).map(i => `<tr><td>${esc(i.company)}</td><td>${esc(i.role)}</td><td>${esc(i.status)}</td><td>${esc(fmtDate(i.applied))}</td></tr>`).join('') + '</table>' + (n > 5 ? `<p class="mn">…and ${n - 5} more.</p>` : '');
  }
  html += '</div>';
  const actions = [{ label: n ? 'Cancel' : 'Close' }];
  if (n) actions.push({
    label: 'Import ' + n, cls: 'p', fn: () => {
      TR.items = TR.items.concat(r.items); saveT(); renderTracker(); updateApplyBtn(); showView('tracker');
      toast('Imported ' + n + ' application' + (n === 1 ? '' : 's') + '.');
    }
  });
  openModal({ title: 'Import applications', html: html, actions: actions, wide: true });
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-tr]');
  if (!b || b.tagName === 'SELECT') return;
  const a = b.dataset.tr;
  if (a === 'add') openApp(null);
  else if (a === 'edit') openApp(b.dataset.id);
  else if (a === 'cv') openCV(b.dataset.cv);
  else if (a === 'imp') $('#csvfile').click();
  else if (a === 'exp') exportCSV();
  else if (a === 'builder') showView('builder');
  else if (a === 'chip') { TF.status = b.dataset.v; renderChips(); renderList(); }
});
document.addEventListener('change', e => {
  const s = e.target.closest && e.target.closest('[data-tr="status"]');
  if (!s) return;
  const it = TR.items.find(i => i.id === s.dataset.id);
  if (!it) return;
  if (TD.setStatus(it, s.value)) {
    saveT(); renderTracker();
    const again = document.querySelector('[data-tr="status"][data-id="' + it.id + '"]');
    if (again) again.focus();
    toast((it.company || 'Application') + ' marked ' + s.value + '.');
  }
});
$('#t-q').addEventListener('input', e => { TF.q = e.target.value; renderList(); });
$('#t-sort').addEventListener('change', e => { TF.sort = e.target.value; renderList(); });
$('#csvfile').addEventListener('change', e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; });
