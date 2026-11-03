/* Shared basics: helpers, default data, storage, toast and modal. Loaded before everything else except the two pure libraries. */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const L = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
const clone = o => JSON.parse(JSON.stringify(o));
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const TD = TrackerData;

const KEYS = { cv: 'cvb2', tr: 'cvb_track', ai: 'cvb_ai', view: 'cvb_view' };
const DEFAULT_MODEL = 'claude-sonnet-5-5';

/* ---------- Starter content (placeholders only: no personal data lives in the code) ---------- */
const JOB0 = () => ({ link: '', location: '', mode: '', salary: '', source: '' });
const DEF = {
  jd: '',
  name: 'Alex Morgan',
  title: 'Software Engineer | Full-Stack Developer',
  email: 'alex.morgan@email.com',
  phone: '+00 000 000 0000',
  loc: 'City, Country',
  links: 'yourportfolio.com\nlinkedin.com/in/your-name\ngithub.com/your-username',
  summary: 'Software Engineer with X years of experience building web applications, REST APIs and database-driven systems. Skilled in [your main languages and frameworks]. Replace this with 2-3 sentences that mirror the job you are applying for.',
  skills: [
    { on: 1, label: 'Programming Languages', items: 'JavaScript, TypeScript, Python, SQL' },
    { on: 1, label: 'Frontend Development', items: 'React.js, HTML5, CSS3, Tailwind CSS' },
    { on: 1, label: 'Backend Development', items: 'Node.js, Express.js, REST APIs' },
    { on: 1, label: 'Databases', items: 'MySQL, PostgreSQL, MongoDB' },
    { on: 1, label: 'Tools and Deployment', items: 'Git, GitHub, Docker, Postman, CI/CD' }],
  exp: [
    { on: 1, role: 'Job Title', org: 'Company Name', loc: 'City, Country', dates: 'MM/YYYY - MM/YYYY', b: 'Start each bullet with a strong verb and say what you built or improved.\nAdd numbers where you can, for example: reduced page load time by 30%.\nMention the technologies you used in the job.' }],
  proj: [
    { on: 1, name: 'Project Name - Short Description', tech: 'React.js, Node.js, MongoDB', dates: 'YYYY', b: 'What the project does and who it is for.\nYour specific contribution and the result.' }],
  edu: [
    { on: 1, degree: 'Degree Name', school: 'University Name', dates: 'YYYY - YYYY', b: '' }],
  awards: [
    { on: 0, text: 'Award or certification name, Issuer', dates: 'MM/YYYY' }],
  job: JOB0(),
  cl: {
    company: '', role: '', manager: '', reason: '', date: '', sign: 'Kind regards,',
    body: 'I am writing to apply for the {role} position at {company}. I am a [your title] with [X years] of experience in [your main area], and I am excited by the chance to contribute to your team.\n\nIn my most recent role at [Company], I [describe your strongest relevant achievement]. I work with [key technologies from the job description], and I enjoy turning requirements into reliable, maintainable software.\n\nI am drawn to {company} because {reason}. I would welcome the opportunity to discuss how my experience can support your team. Thank you for your time and consideration.'
  }
};
const EMPTY = { jd: '', name: '', title: '', email: '', phone: '', loc: '', links: '', summary: '', skills: [], exp: [], proj: [], edu: [], awards: [], job: JOB0(), cl: { company: '', role: '', manager: '', reason: '', date: '', sign: 'Kind regards,', body: '' } };
const NEW = { skills: { on: 1, label: '', items: '' }, exp: { on: 1, role: '', org: '', loc: '', dates: '', b: '' }, proj: { on: 1, name: '', tech: '', dates: '', b: '' }, edu: { on: 1, degree: '', school: '', dates: '', b: '' }, awards: { on: 1, text: '', dates: '' } };
const LISTS = {
  skills: { t: 'Technical skills', h: 'label', f: [['label', 'Category'], ['items', 'Skills, comma separated', 3]] },
  exp: { t: 'Professional experience', h: 'role', f: [['role', 'Job title'], ['org', 'Company'], ['loc', 'Location'], ['dates', 'Dates (MM/YYYY - MM/YYYY)'], ['b', 'Bullets, one per line', 8]] },
  proj: { t: 'Projects', h: 'name', f: [['name', 'Project name'], ['tech', 'Tech stack'], ['dates', 'Year'], ['b', 'Bullets, one per line', 5]] },
  edu: { t: 'Education', h: 'degree', f: [['degree', 'Degree'], ['school', 'Institution'], ['dates', 'Dates'], ['b', 'Notes, one per line', 2]] },
  awards: { t: 'Awards', h: 'text', f: [['text', 'Award'], ['dates', 'Date']] }
};

/* Makes older saved versions compatible with new fields, so nothing you saved earlier breaks. */
function fixCV(d) {
  const base = clone(EMPTY);
  for (const k in base) if (d[k] === undefined || d[k] === null) d[k] = base[k];
  ['skills', 'exp', 'proj', 'edu', 'awards'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
  d.job = Object.assign(JOB0(), d.job || {});
  d.cl = Object.assign(clone(EMPTY.cl), d.cl || {});
  return d;
}
function fixCVStore(v) {
  if (!v || !Array.isArray(v.list)) return null;
  v.list = v.list.filter(x => x && typeof x === 'object' && x.data && typeof x.data === 'object');
  if (!v.list.length) return null;
  v.list.forEach((x, i) => { if (x.id == null) x.id = Date.now() + i; if (!x.name) x.name = 'Version ' + (i + 1); fixCV(x.data); });
  if (!v.list.some(x => x.id == v.cur)) v.cur = v.list[0].id;
  return v;
}

/* ---------- Storage (all in this browser: nothing is uploaded) ---------- */
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
let warnedStorage = false;
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (e) {
    if (!warnedStorage) { warnedStorage = true; toast('Could not save in this browser (storage is full or blocked). Download a backup now.'); }
    return false;
  }
}
let V = fixCVStore(lsGet(KEYS.cv)) || { cur: 1, list: [{ id: 1, name: 'Master CV', data: clone(DEF) }] };
let TR = TD.fixTracker(lsGet(KEYS.tr));
let tab = 'cv';

function stamp() {
  const s = document.querySelector('#st');
  if (!s || !s.classList) return;
  s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash');
  s.lastElementChild.textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
const save = () => { lsSet(KEYS.cv, V); stamp(); };
const saveT = () => { lsSet(KEYS.tr, TR); const c = document.querySelector('#tcount'); if (c) c.textContent = TR.items.length; };
const cur = () => V.list.find(v => v.id == V.cur) || V.list[0];
const D = () => cur().data;
function set(p, v) { const a = p.split('.'); let o = D(); while (a.length > 1) o = o[a.shift()]; o[a[0]] = v; }

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, act) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.innerHTML = '<span></span>';
  el.firstChild.textContent = msg;
  if (act) {
    const b = document.createElement('button');
    b.textContent = act.label;
    b.addEventListener('click', () => { el.classList.remove('show'); act.fn(); });
    el.appendChild(b);
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), act ? 7000 : 4000);
}

/* ---------- Modal ---------- */
let modalEl = null, modalActs = [], modalFocus = null;
function openModal(o) {
  closeModal();
  modalFocus = document.activeElement;
  modalActs = o.actions || [];
  const root = $('#modal-root');
  root.innerHTML = '<div class="mback"><div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="mttl">' +
    '<div class="mh"><h2 id="mttl">' + esc(o.title) + '</h2><button class="mx" data-m="x" aria-label="Close">×</button></div>' +
    '<div class="mb">' + o.html + '</div>' +
    '<div class="mf">' + modalActs.map((a, i) => '<button class="' + esc(a.cls || '') + '" data-m="' + i + '">' + esc(a.label) + '</button>').join('') + '</div></div></div>';
  modalEl = root.firstElementChild;
  const first = modalEl.querySelector('.mb input:not([type=hidden]),.mb select,.mb textarea') || modalEl.querySelector('.mf .p');
  if (first) first.focus();
  return modalEl.querySelector('.modal');
}
function closeModal() {
  if (!modalEl) return;
  $('#modal-root').innerHTML = '';
  modalEl = null; modalActs = [];
  if (modalFocus && modalFocus.focus && document.contains(modalFocus)) modalFocus.focus();
  modalFocus = null;
}
document.addEventListener('click', e => {
  if (!modalEl) return;
  if (e.target.classList && e.target.classList.contains('mback')) { closeModal(); return; }
  const b = e.target.closest('[data-m]');
  if (!b || !modalEl.contains(b)) return;
  if (b.dataset.m === 'x') { closeModal(); return; }
  const a = modalActs[+b.dataset.m];
  if (!a) return;
  const r = a.fn ? a.fn(modalEl.querySelector('.modal')) : undefined;
  if (r !== false) closeModal();
});
document.addEventListener('keydown', e => {
  if (!modalEl) return;
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { const p = modalEl.querySelector('.mf .p'); if (p) { e.preventDefault(); p.click(); } return; }
  if (e.key === 'Tab') {
    const f = Array.from(modalEl.querySelectorAll('button,input,select,textarea,summary,a[href]')).filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }
});

/* A labelled form field for dialogs. */
function fld(name, label, val, o) {
  o = o || {};
  const v = esc(val == null ? '' : val);
  let ctl;
  if (o.area) ctl = '<textarea name="' + name + '" rows="' + o.area + '">' + v + '</textarea>';
  else if (o.sel) ctl = '<select class="fs" name="' + name + '">' + o.sel.map(x => '<option value="' + esc(x[0]) + '"' + (String(x[0]) === String(val || '') ? ' selected' : '') + '>' + esc(x[1]) + '</option>').join('') + '</select>';
  else ctl = '<input name="' + name + '" type="' + (o.type || 'text') + '" value="' + v + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.type === 'password' ? ' autocomplete="off" spellcheck="false"' : '') + '>';
  return '<label>' + label + ctl + '</label>';
}
const mval = (m, n) => { const el = m.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };

/* Copy text to the clipboard, with a fallback for browsers that block the async API. */
function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
  return new Promise((res, rej) => {
    const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select();
    try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); } a.remove();
  });
}
