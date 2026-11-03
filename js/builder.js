/* CV builder: editor panel and the CV, cover letter and keyword previews. */

/* ---------- Editor ---------- */
const inp = (p, l, v, r) => `<label>${l}${r ? `<textarea data-p="${p}" rows="${r}">${esc(v)}</textarea>` : `<input data-p="${p}" value="${esc(v)}">`}</label>`;
const sel = (p, l, v, opts) => `<label>${l}<select class="fs" data-p="${p}">${opts.map(o => `<option value="${esc(o[0])}"${o[0] === (v || '') ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
function snap() {
  const s = { sec: $$('#ed>details').map(x => x.open), it: {}, top: $('#ed').scrollTop };
  $$('#ed [data-k]').forEach(x => { s.it[x.dataset.k] = x.open; });
  return s;
}
function ed(st) {
  const d = D(), c = d.cl, j = d.job;
  let h = `<details open><summary>Job details</summary>
<p class="hint">Paste the posting, then check the Job fit tab before you edit anything. When you apply, these details are saved to your Applications.</p>
${inp('cl.company', 'Company', c.company)}${inp('cl.role', 'Job title', c.role)}
${inp('jd', 'Job description', d.jd, 9)}
<div class="row"><button data-g="detect">Fill empty fields from the description</button></div>
${inp('job.link', 'Job link', j.link)}
<div class="g2">${inp('job.location', 'Location', j.location)}${sel('job.mode', 'Work mode', j.mode, [['', 'Not set'], ['Remote', 'Remote'], ['Hybrid', 'Hybrid'], ['On-site', 'On-site']])}</div>
<div class="g2">${inp('job.salary', 'Salary', j.salary)}${inp('job.source', 'Found on', j.source)}</div></details>
<details><summary>Personal details</summary>${inp('name', 'Full name', d.name)}${inp('title', 'Headline', d.title)}${inp('email', 'Email', d.email)}${inp('phone', 'Phone', d.phone)}${inp('loc', 'Location', d.loc)}${inp('links', 'Links, one per line', d.links, 3)}</details>
<details><summary>Professional summary</summary>${inp('summary', 'Summary', d.summary, 7)}</details>`;
  for (const k in LISTS) {
    const cf = LISTS[k];
    h += `<details><summary>${cf.t}<span class="n" data-n="${k}"></span></summary><p class="hint">Switch an item off to hide it from the CV.</p>`;
    d[k].forEach((o, i) => {
      h += `<div class="ih"><input type="checkbox" data-p="${k}.${i}.on" ${o.on ? 'checked' : ''} aria-label="Show on CV"><details data-k="${k}.${i}"><summary>${esc(o[cf.h] || 'Untitled')}</summary>${cf.f.map(([f, l, r]) => inp(`${k}.${i}.${f}`, l, o[f], r)).join('')}<div class="row"><button data-a="up:${k}:${i}">Move up</button><button data-a="dn:${k}:${i}">Move down</button><button data-a="rm:${k}:${i}">Remove</button></div></details></div>`;
    });
    h += `<button class="add" data-a="add:${k}:0">Add item</button></details>`;
  }
  h += `<details><summary>Cover letter</summary>${inp('cl.manager', 'Hiring manager (optional)', c.manager)}${inp('cl.reason', 'Why this company? Completes "I am drawn to the company because ..." e.g. its focus on scalable ERP products', c.reason, 3)}${inp('cl.date', 'Date (blank = today)', c.date)}${inp('cl.body', 'Letter body. Blank line between paragraphs. Use {company}, {role}, {manager}, {reason}.', c.body, 16)}${inp('cl.sign', 'Sign-off', c.sign)}<p class="hint">Company and job title come from Job details.</p></details>`;
  $('#ed').innerHTML = h;
  if (st) {
    $$('#ed>details').forEach((x, n) => { if (n in st.sec) x.open = !!st.sec[n]; });
    $$('#ed [data-k]').forEach(x => { if (x.dataset.k in st.it) x.open = !!st.it[x.dataset.k]; });
    $('#ed').scrollTop = st.top;
  }
}

/* ---------- Preview ---------- */
const on = a => a.filter(x => x.on);
const sec = (t, h) => h ? `<h2>${t}</h2>${h}` : '';
const ul = s => L(s).length ? `<ul>${L(s).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
const clean = u => String(u || '').replace(/[​-‍⁠﻿ ]/g, '').trim();
const urlOf = u => { u = clean(u); if (!u) return null; try { const x = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : 'https://' + u); return /^https?:$/.test(x.protocol) && x.hostname.includes('.') ? x : null; } catch (e) { return null; } };
const lk = u => { const x = urlOf(u); if (!x) return esc(clean(u)); return `<a href="${esc(x.href)}" target="_blank" rel="noopener noreferrer">${esc((x.host.replace(/^www\./, '') + x.pathname + x.search).replace(/\/$/, ''))}</a>`; };
const linkList = t => String(t || '').split(/[\n,|]+|\s{2,}/).map(clean).filter(Boolean);
const contact = d => { const a = [d.email && `<a href="mailto:${esc(d.email)}">${esc(d.email)}</a>`, esc(d.phone), esc(d.loc)].filter(Boolean).join(' | '), b = linkList(d.links).map(lk).join(' | '); return a + (a && b ? '<br>' : '') + b; };
const mk = h => h.replace(/\[[^\]]+\]/g, '<mark>$&</mark>');
const wrap = h => `<table class="pg"><thead><tr><td><div class="sp"></div></td></tr></thead><tbody><tr><td>${h}</td></tr></tbody><tfoot><tr><td><div class="sp"></div></td></tr></tfoot></table>`;
function cv(d) {
  return `<h1>${esc(d.name)}</h1><p class="t">${esc(d.title)}</p><p class="c">${contact(d)}</p>`
    + sec('Professional Summary', d.summary ? `<p>${esc(d.summary)}</p>` : '')
    + sec('Technical Skills', on(d.skills).map(s => `<p><b>${esc(s.label)}:</b> ${esc(s.items)}</p>`).join(''))
    + sec('Professional Experience', on(d.exp).map(e => `<div class="h"><b>${esc(e.role)}</b><span>${esc(e.dates)}</span></div><div class="s">${esc([e.org, e.loc].filter(Boolean).join(', '))}</div>${ul(e.b)}`).join(''))
    + sec('Projects', on(d.proj).map(p => `<div class="h"><b>${esc(p.name)}</b><span>${esc(p.dates)}</span></div>${p.tech ? `<div class="s">${esc(p.tech)}</div>` : ''}${ul(p.b)}`).join(''))
    + sec('Education', on(d.edu).map(e => `<div class="h"><b>${esc(e.degree)}</b><span>${esc(e.dates)}</span></div><div class="s">${esc(e.school)}</div>${ul(e.b)}`).join(''))
    + sec('Awards and Achievements', on(d.awards).length ? `<ul>${on(d.awards).map(a => `<li>${esc(a.text)}${a.dates ? ' | ' + esc(a.dates) : ''}</li>`).join('')}</ul>` : '');
}
function cl(d) {
  const c = d.cl;
  const f = x => esc(String(x || '').replace(/\{reason\}|\[(add )?one specific reason[^\]]*\]/g, c.reason || '[one specific reason: its product, mission or technology]').replace(/\{company\}/g, c.company || '[Company Name]').replace(/\{role\}/g, c.role || '[Job Title]').replace(/\{manager\}/g, c.manager || 'Hiring Manager'));
  const date = c.date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const addr = [c.manager, c.company || '[Company Name]'].filter(Boolean).map(esc).join('<br>');
  const h = `<div class="hd"><h1>${esc(d.name)}</h1><p class="c">${contact(d)}</p></div>`
    + `<p class="dt">${esc(date)}</p><p class="ad">${addr}</p>`
    + `<p class="sb"><b>Re: Application for ${esc(c.role || '[Job Title]')}</b></p><p>Dear ${esc(c.manager || 'Hiring Manager')},</p>`
    + String(c.body || '').split(/\n\s*\n/).filter(x => x.trim()).map(x => `<p>${f(x.trim())}</p>`).join('')
    + `<p class="cs">${esc(c.sign)}</p><p class="nm"><b>${esc(d.name)}</b></p>`;
  const m = mk(h);
  return (m.includes('<mark>') ? '<div class="warn">Fill in the highlighted [brackets] (company, role, your reason for applying) before you print.</div>' : '') + wrap(m);
}

/* ---------- Quick keyword check (unchanged) ---------- */
const TECH = 'javascript,typescript,python,java,c#,c++,php,ruby,sql,nosql,html,css,sass,tailwind,react,next.js,vue,angular,node,express,django,flask,fastapi,spring,.net,asp.net,entity framework,graphql,rest,restful,api,apis,microservices,mysql,postgresql,mongodb,redis,sql server,oracle,firebase,supabase,docker,kubernetes,aws,azure,gcp,ci/cd,jenkins,github actions,git,linux,terraform,agile,scrum,jira,testing,unit testing,jest,cypress,playwright,selenium,tdd,oauth,jwt,authentication,websockets,machine learning,deep learning,tensorflow,pytorch,scikit-learn,pandas,numpy,nlp,computer vision,llm,data science,etl,power bi,tableau,erp,saas,react native,flutter,swift,kotlin,devops,cloud,security,debugging,code review,design patterns,oop,figma,n8n,postman,optimization,scalable'.split(',');
const STOP = new Set('about above after also and any are been being both but can cost could each etc for from have has into its more most must new not our out over per such than that the their them then there these they this those use used using was were what when where which while who will with within without work working you your able across including strong ability experience years year team teams role join company candidate looking responsibilities requirements required preferred skills knowledge good great well plus should would'.split(' '));
const norm = t => String(t).toLowerCase().replace(/\breact\.?js\b/g, 'react').replace(/\bnode\.?js\b/g, 'node').replace(/\bnext\.?js\b/g, 'next.js').replace(/\bvue\.?js\b/g, 'vue').replace(/\bexpress\.?js\b/g, 'express');
const has = (t, x) => new RegExp('(^|[^a-z0-9+#.])' + x.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '(?![a-z0-9+#])').test(t);
function cvText(d) {
  return norm([d.title, d.summary, ...on(d.skills).map(s => s.label + ' ' + s.items), ...on(d.exp).map(e => e.role + ' ' + e.org + ' ' + e.b), ...on(d.proj).map(p => p.name + ' ' + p.tech + ' ' + p.b), ...on(d.edu).map(e => e.degree + ' ' + e.b)].join(' \n '));
}
function kw(d) {
  if (!d.jd.trim()) return '<h2>Keyword match</h2><p>Paste a job description in Job details (first section) to see which keywords your CV already covers and which are missing.</p>';
  const jd = norm(d.jd), cvt = cvText(d);
  const terms = TECH.filter(x => has(jd, x));
  const hit = terms.filter(x => has(cvt, x)), miss = terms.filter(x => !has(cvt, x));
  const cnt = {}; jd.split(/[^a-z0-9+#]+/).forEach(w => { if (w.length > 3 && !STOP.has(w) && !TECH.includes(w)) cnt[w] = (cnt[w] || 0) + 1; });
  const other = Object.entries(cnt).filter(e => e[1] >= 2).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const chip = (w, ok, n) => `<span class="chip ${ok ? 'ok' : 'no'}">${esc(w)}${n ? ' x' + n : ''}</span>`;
  const pct = terms.length ? Math.round(hit.length / terms.length * 100) : 0;
  return `<h2>Keyword match</h2><p class="sc"><span class="score" style="--p:${pct}">${pct}%</span><span>of the ${terms.length} technical keywords in this job description appear in your CV.</span></p>
<h2>Missing technical keywords</h2><p>${miss.map(w => chip(w, 0)).join('') || 'None. Nice.'}</p>
<h2>Already covered</h2><p>${hit.map(w => chip(w, 1)).join('') || 'None yet.'}</p>
<h2>Other repeated words in the posting</h2><p>${other.map(([w, n]) => chip(w, has(cvt, w), n)).join('') || 'None.'}</p>
<p class="hint">This is a quick word check. The Job fit tab goes deeper: must-haves, evidence, experience and bullet quality. Only add a keyword if it is true for you.</p>`;
}

function cnt() { const d = D(); for (const k in LISTS) { const el = document.querySelector('[data-n="' + k + '"]'); if (el) el.textContent = on(d[k]).length + ' of ' + d[k].length + ' shown'; } }
function pv() {
  const d = D(); cnt();
  const wide = tab === 'kw' || tab === 'fit';
  $('#paper').className = 'paper' + (wide ? ' kw' : tab === 'cl' ? ' cl' : '');
  $('#paper').innerHTML = tab === 'cv' ? wrap(cv(d)) : tab === 'cl' ? cl(d) : tab === 'kw' ? kw(d) : fitHTML(d);
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t == tab));
  document.title = d.name + ' - ' + (tab === 'cl' ? 'Cover Letter' + (d.cl.company ? ' - ' + d.cl.company : '') : 'CV');
  if (typeof updateApplyBtn === 'function') updateApplyBtn();
}
function vers() {
  $('#ver').innerHTML = V.list.map(v => `<option value="${v.id}" ${v.id == V.cur ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
}
