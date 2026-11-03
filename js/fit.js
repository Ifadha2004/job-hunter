/* The Job fit tab: renders the analyzer's report, plus the optional AI review. */

let aiBusy = false, aiErr = '';
const aiCfg = () => Object.assign({ key: '', model: DEFAULT_MODEL }, lsGet(KEYS.ai) || {});

const tierOf = s => s == null ? 'n' : s >= 75 ? 'a' : s >= 50 ? 'b' : s >= 30 ? 'c' : 'd';
function evChip(r) {
  const e = r.ev, t = e.score >= 0.85 ? 'a' : e.score >= 0.6 ? 'b' : e.score >= 0.3 ? 'c' : 'd';
  let txt;
  if (e.type === 'none') txt = 'Not found';
  else if (e.type === 'related') txt = 'Related: ' + e.via;
  else if (e.type === 'implied') txt = 'Implied by ' + e.via;
  else txt = e.kind === 'pro' ? 'Work experience' : e.kind === 'proj' ? (e.bullets ? 'Project work' : 'Named in a tech list') : 'Skills list only';
  return `<span class="chip ev-${t}">${esc(txt)}</span>`;
}
function reqRow(r) {
  const e = r.ev;
  let det;
  if (e.type === 'none') det = `Asked for: <q>${esc(r.ctx)}</q>`;
  else if (e.type === 'related') det = `You list ${esc(e.via)}, a related technology, so this earns partial credit.`;
  else if (e.type === 'implied') det = `Counts because you show ${esc(e.via)}.`;
  else det = 'Found in: ' + esc(e.where.join(', '));
  if (e.yearsNeed) det += ` ${e.yearsNeed}+ years asked` + (e.yearsHave !== undefined ? `, about ${e.yearsHave} shown in your roles.` : '.');
  return `<li><div><b>${esc(r.name)}</b> ${evChip(r)}</div><div class="d">${det}</div></li>`;
}
const group = (title, list) => list.length ? `<h3>${title}<span>${list.length}</span></h3><ul class="rqs">${list.map(reqRow).join('')}</ul>` : '';

function fmtAI(text) {
  const inline = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  let out = '', list = false;
  String(text).split('\n').forEach(raw => {
    const t = raw.trim();
    const li = /^([-*•]|\d+[.)])\s+(.*)$/.exec(t);
    if (li) { if (!list) { out += '<ul>'; list = true; } out += '<li>' + inline(li[2]) + '</li>'; return; }
    if (list) { out += '</ul>'; list = false; }
    if (!t) return;
    const h = /^#{1,4}\s+(.*)$/.exec(t);
    out += h ? '<h3>' + inline(h[1]) + '</h3>' : '<p>' + inline(t) + '</p>';
  });
  return out + (list ? '</ul>' : '');
}

function aiBlock(d) {
  const cfg = aiCfg(), has = !!cfg.key, r = d.aiReview;
  let h = '<h2>AI review</h2><div class="ai-box">';
  h += '<p>The checks above are rule-based. For a human-style read of how convincing your evidence is, with rewrite drafts for weak bullets, run an AI review. It uses <b>your own Anthropic API key</b> and sends your CV and the job description straight from your browser to Anthropic.</p>';
  h += '<div class="btns">';
  if (!d.jd.trim()) h += '<span class="hint">Paste a job description first.</span>';
  else if (has) h += `<button class="p" data-g="ai-run"${aiBusy ? ' disabled' : ''}>${aiBusy ? '<span class="ai-busy"></span>Reviewing…' : (r ? 'Run again' : 'Run AI review')}</button>`;
  else h += '<button class="p" data-g="ai-set">Set up AI review</button>';
  if (d.jd.trim()) h += '<button data-g="ai-prompt">Copy prompt for any AI chat</button>';
  if (has) h += '<button data-g="ai-set">Settings</button>';
  h += '</div>';
  if (aiErr) h += `<p class="ai-err">${esc(aiErr)}</p>`;
  if (r && r.text) h += `<div class="ai-res"><p class="hint">Reviewed ${esc(new Date(r.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))} with ${esc(r.model)}. Your CV may have changed since.</p>${fmtAI(r.text)}</div>`;
  return h + '</div>';
}

function fitHTML(d) {
  const R = Analyzer.analyze(d);
  let h = '';
  if (!R.hasJD) {
    h += '<h2>Job fit</h2><p>Paste a job description into <b>Job details</b> and this tab shows how well your CV fits it: which requirements are must-haves, how strongly your CV proves each one, and what to fix first.</p><p>Below is a health check of the CV itself, which works without a posting.</p>';
  } else {
    const v = R.verdict;
    h += `<div class="fh"><span class="score lg t-${v.key}" style="--p:${R.overall}">${R.overall}</span><div><h2>${esc(v.label)}${R.role ? ' for ' + esc(clip(R.role, 60)) : ''}</h2><p>${esc(v.advice)}</p><p class="hint">An estimate from the words in your CV and the posting. Real ATS software and recruiters vary.</p></div></div>`;
    h += '<h2>Score breakdown</h2>' + R.components.map(c => `<div class="mtr"><span>${esc(c.label)}</span><div class="mtr-b"><i class="t-${tierOf(c.score)}" style="width:${c.score || 0}%"></i></div><b>${c.score == null ? 'n/a' : c.score + '%'}</b><small>${esc(c.note)}</small></div>`).join('');
    if (R.actions.length) h += '<h2>What to do next</h2><ul class="acts">' + R.actions.map(a => `<li class="${a.tone}">${esc(a.text)}</li>`).join('') + '</ul>';
    const hard = R.reqs.filter(x => x.cat !== 'Soft skills');
    h += '<h2>Requirements and your evidence</h2>';
    if (!hard.length) h += '<p>No recognisable skills were found in the posting. Paste the full description, including the requirements list.</p>';
    h += group('Must-have', hard.filter(x => x.level === 'req')) + group('Expected in the role', hard.filter(x => x.level === 'core')) + group('Nice to have', hard.filter(x => x.level === 'pref'));
    if (R.soft.length) h += `<details><summary>Soft skills mentioned (${R.soft.length})</summary><p>${R.soft.map(x => `<span class="chip ev-${x.ev.score >= 0.6 ? 'b' : 'c'}">${esc(x.name)}</span>`).join('')}</p><p class="hint">Soft skills are not scored. Show them through what you did, not as claims.</p></details>`;
    h += '<h2>Experience and education</h2>';
    h += `<p>Your CV shows about <b>${R.haveYears} years</b> of experience across ${on(d.exp).length} role(s)${R.experience.need ? `; the posting asks for ${R.experience.need}+` : ''}.${R.experience.seniority ? ' The title suggests ' + esc(R.experience.seniority.label.toLowerCase()) + '.' : ''} Overlapping roles are counted once.</p><p>${esc(R.education.note)}.</p>`;
  }
  const A = R.ach;
  h += '<h2>Achievement bullets</h2>';
  if (!A.total) h += '<p>No experience or project bullets found. Add 3 to 5 bullets per role.</p>';
  else {
    h += `<p>${A.total} bullets checked: <b>${A.withMetric}</b> show a number or scale. Quality score <b>${A.score}/100</b>. Bullets score higher when they start with a strong verb, name the technology, show a result and include a real figure.</p>`;
    h += A.weakest.map(b => `<div class="bl"><b>${esc(b.label || 'Bullet')}</b><q>${esc(clip(b.text, 190))}</q>${b.flags.map(f => `<span class="chip fl">${esc(f)}</span>`).join('')}</div>`).join('');
    if (A.weakest.length) h += '<p class="hint">Improve these with real details only. Do not invent numbers.</p>';
  }
  const bad = R.ats.checks.filter(c => !c.ok).length;
  h += `<details${bad ? ' open' : ''}><summary>ATS-readiness checks (${R.ats.checks.length - bad} of ${R.ats.checks.length} passed)</summary><ul class="chk">${R.ats.checks.map(c => `<li class="${c.ok ? '' : 'no'}">${esc(c.label)}${c.ok ? '' : `<small>${esc(c.tip)}</small>`}</li>`).join('')}</ul></details>`;
  h += aiBlock(d);
  return h;
}

/* ---------- AI review (uses the visitor's own key) ---------- */
async function runAI() {
  const cfg = aiCfg(), d = D();
  if (!cfg.key) { openAISettings(); return; }
  if (!d.jd.trim()) { toast('Paste a job description first.'); return; }
  aiBusy = true; aiErr = ''; pv();
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: cfg.model || DEFAULT_MODEL, max_tokens: 3000, messages: [{ role: 'user', content: Analyzer.aiPrompt(d) }] })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const m = (j.error && j.error.message) || '';
      throw new Error(res.status === 401 ? 'The API key was rejected. Check it in AI review settings.' : res.status === 404 ? 'That model name was not found. Check the model in AI review settings.' : res.status === 429 ? 'Rate limit or credit limit reached. Try again shortly.' : (m || 'The request failed (' + res.status + ').'));
    }
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!text) throw new Error('The model returned no text. Try again.');
    d.aiReview = { text: text, at: Date.now(), model: cfg.model || DEFAULT_MODEL };
    save();
  } catch (e) {
    aiErr = e.name === 'AbortError' ? 'The request timed out. Try again.' : e instanceof TypeError ? 'Could not reach the API. Check your connection, or whether an extension or network blocks api.anthropic.com.' : e.message;
  } finally {
    clearTimeout(timer); aiBusy = false; pv();
  }
}
function openAISettings() {
  const c = aiCfg();
  openModal({
    title: 'AI review settings',
    html: '<p class="mn">The AI review sends your CV and the job description directly from this browser to Anthropic, using <b>your own API key</b>. There is no server in between, and the key is stored only in this browser. Usage is billed to your Anthropic account.</p>'
      + '<p class="mn"><b>Only use this on a computer you trust.</b> Anyone who can open this browser profile can read a saved key.</p>'
      + fld('key', 'Anthropic API key', c.key, { type: 'password', ph: 'sk-ant-…' })
      + fld('model', 'Model', c.model)
      + '<p class="mn">You can create a key in the Anthropic Console. No key? Use “Copy prompt for any AI chat” on the Job fit tab instead.</p>',
    actions: [
      { label: 'Remove key', cls: 'danger left', fn: () => { lsSet(KEYS.ai, { key: '', model: c.model }); toast('API key removed.'); pv(); } },
      { label: 'Cancel' },
      { label: 'Save', cls: 'p', fn: m => { lsSet(KEYS.ai, { key: mval(m, 'key'), model: mval(m, 'model') || DEFAULT_MODEL }); toast('Saved. The key stays in this browser.'); pv(); } }
    ]
  });
}
function copyAIPrompt() {
  const d = D();
  if (!d.jd.trim()) { toast('Paste a job description first.'); return; }
  copyText(Analyzer.aiPrompt(d)).then(() => toast('Prompt copied. Paste it into Claude, ChatGPT or any AI chat.'), () => toast('Could not copy. Your browser blocked clipboard access.'));
}
