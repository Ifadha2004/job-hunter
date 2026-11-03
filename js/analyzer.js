/* Job-fit analyzer. Pure functions: no DOM, no storage. Works in the browser (window.Analyzer) and in Node (tests).
 *
 * What it does (all offline, nothing leaves the browser):
 *  - reads a job description and finds the skills it asks for (with synonyms, e.g. k8s = Kubernetes)
 *  - sorts them into must-have / expected / nice-to-have from headings and wording
 *  - checks how strongly your CV demonstrates each one (work > project > listed only)
 *  - gives credit for implied and related technologies (Next.js implies React, MySQL relates to PostgreSQL)
 *  - compares years of experience, seniority and education
 *  - scores the quality of your achievement bullets and the ATS hygiene of the CV
 * It is an estimate. It cannot judge writing quality the way a person or an AI model can.
 */
(function (root) {
  'use strict';

  /* ---------- Skill taxonomy: Name|Category|aliases|implies  (a leading ! means: do not match the bare name) ---------- */
  const TAX = [
    'JavaScript|Languages|js,es6,es2015,ecmascript,vanilla js|',
    'TypeScript|Languages|ts|JavaScript',
    'Python|Languages|python3|',
    'Java|Languages|java se,jdk|',
    'C#|Languages|c sharp,csharp|',
    'C++|Languages|cpp|',
    '!C|Languages|c language,c programming|',
    '!Go|Languages|golang,go lang,go programming|',
    'Rust|Languages||',
    'PHP|Languages||',
    'Ruby|Languages||',
    'Kotlin|Languages||',
    'Swift|Languages|swiftui|',
    'Dart|Languages||',
    'SQL|Databases|t-sql,tsql,pl/sql,plsql,structured query language,relational databases,relational database,rdbms|',
    'HTML|Frontend|html5|',
    'CSS|Frontend|css3|',
    'Sass|Frontend|scss|CSS',
    'Tailwind CSS|Frontend|tailwind,tailwindcss|CSS',
    'Bootstrap|Frontend||CSS',
    'React|Frontend|react.js,reactjs,react js|JavaScript',
    'Next.js|Frontend|nextjs,next js|React,JavaScript',
    'Vue.js|Frontend|vue,vuejs,vue js,nuxt,nuxt.js|JavaScript',
    'Angular|Frontend|angularjs,angular.js|TypeScript,JavaScript',
    'Svelte|Frontend|sveltekit|JavaScript',
    'Redux|Frontend|redux toolkit,rtk|React,JavaScript',
    'jQuery|Frontend||JavaScript',
    'Responsive Design|Frontend|responsive web design,responsive design,mobile-first,mobile first,cross-browser,cross browser|CSS',
    'Accessibility|Frontend|wcag,a11y|',
    'Node.js|Backend|node,nodejs,node js|JavaScript',
    'Express.js|Backend|expressjs,express js|Node.js,JavaScript',
    'NestJS|Backend|nest.js|Node.js,TypeScript',
    'Django|Backend||Python',
    'Flask|Backend||Python',
    'FastAPI|Backend|fast api|Python',
    'Spring Boot|Backend|spring framework,spring mvc|Java',
    'ASP.NET|Backend|asp.net mvc,asp.net core,aspnet,.net mvc|C#,.NET',
    '.NET|Backend|dotnet,.net core,.net framework,.net 8,.net 6,.net 7,.net 9|C#',
    'Entity Framework|Backend|ef core,entity framework core,ef6|C#,.NET',
    'Laravel|Backend||PHP',
    'Ruby on Rails|Backend|rails|Ruby',
    'REST APIs|Backend|rest api,rest apis,restful,restful api,restful apis,web api,web apis,api development,apis,api|',
    'GraphQL|Backend|apollo|',
    'WebSockets|Backend|websocket,socket.io,web sockets,real-time communication|',
    'Microservices|Architecture|microservice,micro-services,micro services|',
    'System Design|Architecture|software architecture,scalable systems,distributed systems,high availability,scalability|',
    'MySQL|Databases|mariadb|SQL',
    'PostgreSQL|Databases|postgres,psql,postgis|SQL',
    'SQL Server|Databases|mssql,ms sql,microsoft sql server,ms sql server,sqlserver|SQL',
    'Oracle|Databases|oracle db,oracle database|SQL',
    'SQLite|Databases||SQL',
    'MongoDB|Databases|mongoose,mongo,mongodb atlas|',
    'Redis|Databases||',
    'Elasticsearch|Databases|elastic search,opensearch,elk|',
    'Firebase|Databases|firestore|',
    'Supabase|Databases||PostgreSQL,SQL',
    'AWS|Cloud|amazon web services,ec2,s3,aws lambda,cloudfront|',
    'Azure|Cloud|microsoft azure,azure devops|',
    'Google Cloud|Cloud|gcp,google cloud platform,bigquery|',
    'Docker|DevOps|containers,containerization,containerisation,dockerfile|',
    'Kubernetes|DevOps|k8s,helm|Docker',
    'CI/CD|DevOps|ci cd,cicd,continuous integration,continuous delivery,continuous deployment,build pipelines|',
    'GitHub Actions|DevOps||CI/CD,Git',
    'Jenkins|DevOps||CI/CD',
    'GitLab CI|DevOps|gitlab ci/cd,gitlab pipelines|CI/CD,Git',
    'Terraform|DevOps|infrastructure as code,iac|',
    'Linux|DevOps|ubuntu,unix,bash,shell scripting|',
    'Nginx|DevOps||',
    'Vercel|DevOps||',
    'Git|Tools|github,gitlab,bitbucket,version control,source control|',
    'Postman|Tools|insomnia,bruno|',
    'Jira|Tools|confluence,trello,asana|',
    'Figma|Tools|adobe xd,sketch|',
    'n8n|Tools|zapier,make.com,workflow automation|',
    'Swagger|Tools|openapi,open api|REST APIs',
    'Jest|Testing|vitest,mocha,jasmine|',
    'Cypress|Testing||',
    'Playwright|Testing||',
    'Selenium|Testing|webdriver|',
    'Unit Testing|Testing|unit tests,unit test,xunit,nunit,junit,pytest|',
    'Test Automation|Testing|automated testing,automation testing,e2e testing,end-to-end testing,integration testing|',
    'TDD|Testing|test-driven development,test driven development|Unit Testing',
    'Agile|Practices|scrum,kanban,sprint,sprints,sprint planning,standups|',
    'Code Review|Practices|code reviews,peer review,pull requests,pull request|',
    'OOP|Practices|object-oriented,object oriented,object-oriented programming|',
    'Design Patterns|Practices|solid principles,clean architecture,mvc,mvvm,domain-driven design,ddd|',
    'Performance Optimization|Practices|performance tuning,query optimization,query optimisation,sql optimization,performance optimisation,caching|',
    'Debugging|Practices|troubleshooting,root cause analysis,rca,bug fixing,bug fixes|',
    'Authentication|Security|oauth,oauth2,jwt,sso,single sign-on,rbac,role-based access control,authorization,authorisation,openid,otp|',
    '!Security|Security|application security,secure coding,owasp,encryption,cybersecurity,cyber security,information security,infosec|',
    'Machine Learning|AI/ML|ml,predictive modeling,predictive modelling,model training|',
    'Deep Learning|AI/ML|neural networks,cnn,rnn,lstm,transformers|Machine Learning',
    'TensorFlow|AI/ML|keras|Machine Learning,Python',
    'PyTorch|AI/ML|torch|Machine Learning,Python',
    'Scikit-learn|AI/ML|sklearn,scikit learn|Machine Learning,Python',
    'NLP|AI/ML|natural language processing,nltk,spacy,text mining|Machine Learning',
    'Computer Vision|AI/ML|opencv,image recognition,object detection,yolo,image processing|Machine Learning',
    'LLMs|AI/ML|large language models,llm,generative ai,genai,gpt,chatgpt,prompt engineering,langchain,rag,retrieval-augmented generation|',
    'AI API Integration|AI/ML|ai apis,ai api,openai,anthropic,claude api,openai api|',
    'Data Analysis|Data|data analytics,analytics,exploratory data analysis,eda|',
    'Pandas|Data|numpy,dataframes|Python',
    'Data Visualization|Data|data visualisation,dashboards,dashboard,charts|',
    'Power BI|Data|tableau,looker|',
    'ETL|Data|data pipelines,data pipeline,data engineering,airflow,spark,pyspark,databricks|',
    '!Excel|Data|ms excel,microsoft excel,advanced excel,excel spreadsheets,excel formulas,spreadsheets,vba|',
    'React Native|Mobile|react-native|React,JavaScript',
    'Flutter|Mobile||Dart',
    'Android|Mobile|android development,android studio|',
    'iOS|Mobile|ios development,xcode|',
    'ERP|Domain|erp systems,sap,odoo,dynamics 365,netsuite|',
    'SaaS|Domain|b2b saas,multi-tenant|',
    'E-commerce|Domain|ecommerce,shopify,woocommerce,payment gateway,payments,stripe|',
    'Communication|Soft skills|communicator,communication skills,written communication,verbal communication,stakeholder communication|',
    'Teamwork|Soft skills|collaboration,collaborative,cross-functional,cross functional,team player|',
    'Leadership|Soft skills|mentoring,mentor,team lead,leading teams,technical leadership,coaching|',
    'Problem Solving|Soft skills|problem-solving,analytical thinking,analytical skills,critical thinking|',
    'Stakeholder Management|Soft skills|stakeholders,client-facing,client facing,client management|'
  ];

  /* Related technologies: [credit factor, members]. Having one gives partial credit for the others. */
  const GROUPS = [
    [0.6, ['React', 'Vue.js', 'Angular', 'Svelte', 'Next.js']],
    [0.6, ['MySQL', 'PostgreSQL', 'SQL Server', 'Oracle', 'SQLite']],
    [0.4, ['MongoDB', 'Firebase', 'Redis', 'Elasticsearch']],
    [0.55, ['AWS', 'Azure', 'Google Cloud']],
    [0.5, ['Docker', 'Kubernetes']],
    [0.6, ['TensorFlow', 'PyTorch', 'Scikit-learn']],
    [0.55, ['Jest', 'Cypress', 'Playwright', 'Selenium', 'Unit Testing', 'Test Automation']],
    [0.6, ['Flask', 'Django', 'FastAPI']],
    [0.45, ['Spring Boot', 'ASP.NET', 'Django', 'Flask', 'FastAPI', 'Express.js', 'NestJS', 'Laravel', 'Ruby on Rails']],
    [0.4, ['Java', 'C#', 'Kotlin']],
    [0.4, ['React Native', 'Flutter', 'Android', 'iOS']],
    [0.6, ['Jenkins', 'GitHub Actions', 'GitLab CI', 'CI/CD']],
    [0.5, ['Power BI', 'Data Visualization', 'Excel']],
    [0.55, ['Tailwind CSS', 'Bootstrap', 'Sass', 'CSS']],
    [0.5, ['REST APIs', 'GraphQL', 'Swagger']],
    [0.5, ['LLMs', 'AI API Integration', 'NLP']],
    [0.5, ['Postman', 'Swagger']]
  ];

  const SK = [], BY = {};
  TAX.forEach(function (line) {
    const p = line.split('|');
    let name = p[0], auto = true;
    if (name[0] === '!') { auto = false; name = name.slice(1); }
    const aliases = (p[2] ? p[2].split(',') : []).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    if (auto) aliases.push(name.toLowerCase());
    const sk = { name: name, cat: p[1], aliases: Array.from(new Set(aliases)), implies: p[3] ? p[3].split(',') : [], related: {} };
    SK.push(sk); BY[name] = sk;
  });
  GROUPS.forEach(function (g) {
    g[1].forEach(function (a) {
      g[1].forEach(function (b) {
        if (a !== b && BY[a] && BY[b]) BY[a].related[b] = Math.max(BY[a].related[b] || 0, g[0]);
      });
    });
  });
  const CLOSURE = {};
  function closure(name) {
    if (CLOSURE[name]) return CLOSURE[name];
    const out = new Set(), todo = (BY[name] ? BY[name].implies : []).slice();
    while (todo.length) { const n = todo.pop(); if (!out.has(n)) { out.add(n); (BY[n] ? BY[n].implies : []).forEach(function (m) { todo.push(m); }); } }
    return (CLOSURE[name] = out);
  }

  const reEsc = function (s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); };
  const PAIRS = [];
  SK.forEach(function (sk) { sk.aliases.forEach(function (a) { PAIRS.push({ a: a, sk: sk }); }); });
  PAIRS.sort(function (x, y) { return y.a.length - x.a.length; });
  PAIRS.forEach(function (p) { p.re = new RegExp('(^|[^a-z0-9+#.])(' + reEsc(p.a) + ')(?![a-z0-9+#])', 'g'); });

  /* Finds skills in a piece of text. Longer aliases are consumed first so "react native" is not also counted as "react". */
  function findSkills(text) {
    let t = ' ' + String(text || '').toLowerCase().replace(/[‘’]/g, "'").replace(/node(?:\.?js)?\s*\/\s*express(?:\.?js)?/g, 'node.js express.js') + ' ';
    const found = new Map();
    for (let i = 0; i < PAIRS.length; i++) {
      const p = PAIRS[i];
      p.re.lastIndex = 0;
      t = t.replace(p.re, function (m, pre, al) {
        found.set(p.sk.name, (found.get(p.sk.name) || 0) + 1);
        return pre + ' '.repeat(al.length);
      });
    }
    return { found: found, rest: t };
  }

  /* ---------- small helpers ---------- */
  const on = function (a) { return (a || []).filter(function (x) { return x && x.on; }); };
  const L = function (s) { return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
  const words = function (s) { return (String(s).match(/[A-Za-z0-9][A-Za-z0-9'+#./-]*/g) || []).length; };
  const r1 = function (n) { return Math.round(n * 10) / 10; };
  const clip = function (s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

  /* ---------- dates ---------- */
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function parseRange(str, now) {
    now = now || new Date();
    const nowI = now.getFullYear() * 12 + now.getMonth();
    const re = /(present|current|now|ongoing|today)|((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*((?:19|20)\d{2}))|(\b(\d{1,2})\s*[\/.\-]\s*((?:19|20)\d{2}))|\b((?:19|20)\d{2})\b/gi;
    const toks = [];
    let m;
    while ((m = re.exec(String(str || '')))) {
      if (m[1]) toks.push({ now: true });
      else if (m[2]) toks.push({ y: +m[3], m: MON.indexOf(m[2].slice(0, 3).toLowerCase()) });
      else if (m[4]) toks.push({ y: +m[6], m: Math.min(12, Math.max(1, +m[5])) - 1 });
      else toks.push({ y: +m[7], m: -1 });
    }
    if (!toks.length) return null;
    const idx = function (t, end) { return t.now ? nowI : t.y * 12 + (t.m >= 0 ? t.m : (end ? 11 : 0)); };
    let s, e;
    if (toks.length === 1) {
      if (toks[0].now) return null;
      s = idx(toks[0], false); e = toks[0].m >= 0 ? s : idx(toks[0], true);
    } else { s = idx(toks[0], false); e = idx(toks[1], true); }
    if (s > nowI) return null;
    if (e > nowI) e = nowI;
    if (e < s) return null;
    return { s: s, e: e };
  }
  function unionMonths(ranges) {
    const r = ranges.filter(Boolean).sort(function (a, b) { return a.s - b.s; });
    let tot = 0, cs = null, ce = null;
    r.forEach(function (x) {
      if (cs === null) { cs = x.s; ce = x.e; }
      else if (x.s <= ce + 1) { ce = Math.max(ce, x.e); }
      else { tot += ce - cs + 1; cs = x.s; ce = x.e; }
    });
    if (cs !== null) tot += ce - cs + 1;
    return tot;
  }

  /* ---------- reading the job description ---------- */
  const REQ_H = /\b(requirements?|qualifications?|what you(?:'|’)?ll need|what we(?:'|’)?re looking for|looking for|who you are|must[- ]haves?|essential|minimum|you have|you bring|you(?:'|’)?ll bring|key skills|technical skills|required skills|skills (?:and|&) (?:experience|qualifications)|about you|your profile|required)\b/i;
  const PREF_H = /\b(nice[- ]to[- ]haves?|preferred|bonus|desirable|good to have|advantages?|a plus|plus points|ideal(?:ly)?|extra credit|additional skills)\b/i;
  const RESP_H = /\b(responsibilit\w*|what you(?:'|’)?ll do|what you will do|the role|duties|day[- ]to[- ]day|your impact|accountabilit\w*|role overview|key tasks|the job|job description)\b/i;
  const OTHER_H = /\b(about (?:us|the company|the team|our)|who we are|benefits|perks|what we offer|why join|why you(?:'|’)?ll love|our (?:mission|culture|values)|compensation|how to apply|equal opportunity|diversity)\b/i;
  const PREF_CUE = /\b(preferred|nice to have|nice-to-have|bonus|plus|desirable|advantage|advantageous|ideally|familiarity|exposure to|an asset|would be (?:great|nice|beneficial|an advantage)|beneficial|good to have|not required|optional)\b/i;
  const REQ_CUE = /\b(must|required|essential|mandatory|minimum of|at least|\d+\s*\+?\s*(?:years?|yrs?))\b/i;
  const EQUIV = /(or equivalent|equivalent (?:practical )?experience|or related|or relevant)/i;

  function splitJD(jd) {
    const out = [];
    String(jd || '').replace(/\r/g, '').split('\n').forEach(function (raw) {
      let t = raw.trim();
      if (!t) return;
      const bullet = /^([•·▪●◦►✓✔→*]|[-–—]\s|\d+[.)]\s)/.test(t);
      t = t.replace(/^([•·▪●◦►✓✔→*]+|[-–—]+\s|\d+[.)]\s)\s*/, '');
      const parts = t.length > 240 ? t.split(/[.!?;]\s+/) : [t];
      parts.forEach(function (p) { p = p.trim(); if (p) out.push({ text: p, bullet: bullet }); });
    });
    return out;
  }

  function sectionOf(text) {
    if (OTHER_H.test(text)) return 'other';
    if (PREF_H.test(text)) return 'pref';
    if (REQ_H.test(text)) return 'req';
    if (RESP_H.test(text)) return 'resp';
    return null;
  }

  function seniorityOf(jd) {
    const head = String(jd || '').split('\n').filter(function (x) { return x.trim(); }).slice(0, 3).join(' ');
    if (/\b(principal|staff|architect|head of|director|vp)\b/i.test(head)) return { label: 'Principal / lead level', min: 7 };
    if (/\b(lead|team lead|tech lead)\b/i.test(head)) return { label: 'Lead level', min: 6 };
    if (/\b(senior|sr\.?)\b/i.test(head)) return { label: 'Senior level', min: 4 };
    if (/\b(mid[- ]level|intermediate)\b/i.test(head)) return { label: 'Mid level', min: 2 };
    if (/\b(intern(?:ship)?|trainee|graduate|entry[- ]level|junior|jr\.?|associate)\b/i.test(head)) return { label: 'Junior / entry level', min: 0 };
    return null;
  }

  function eduLevelOf(text, inProgress) {
    const t = String(text || '').toLowerCase();
    let lv = 0;
    if (/\b(ph\.?d|doctorate|doctoral)\b/.test(t)) lv = 4;
    else if (/\b(msc|m\.sc|master|masters|master's|mba|meng|m\.eng|mphil|mres)\b/.test(t)) lv = 3;
    else if (/\b(bsc|b\.sc|beng|b\.eng|bachelor|bachelors|bachelor's|b\.a|b\.s|ba|bs|honours|honors|\(hons\))\b/.test(t)) lv = 2;
    else if (/\b(hnd|higher national|diploma|associate degree)\b/.test(t)) lv = 1;
    else if (/\bdegree\b/.test(t)) lv = 2;
    return inProgress && lv > 0 ? lv - 1 : lv;
  }

  function parseJD(jd) {
    const lines = splitJD(jd);
    const agg = {};
    const skillYears = {};
    const generalYears = [];
    let section = null, eduNeed = 0, eduEquiv = false;
    const rank = { req: 3, core: 2, pref: 1 };
    const titleLine = lines.length ? lines[0].text : '';
    const titleFound = lines.length && titleLine.length <= 100 ? findSkills(titleLine).found : new Map();

    lines.forEach(function (ln, i) {
      let text = ln.text;
      const inl = /^([^:]{3,45}):\s*(.+)$/.exec(text);
      if (inl && !/\d/.test(inl[1]) && sectionOf(inl[1])) { section = sectionOf(inl[1]); text = inl[2]; }
      const f0 = findSkills(text).found;
      const wc = words(text);
      if (!ln.bullet && !/\d/.test(text) && f0.size === 0 && wc <= 9 && (/:$/.test(text) || wc <= 5) && !/[.!?]$/.test(text)) {
        const s = sectionOf(text);
        if (s) { section = s; return; }
      }
      let level = section === 'req' ? 'req' : section === 'pref' ? 'pref' : section === 'other' ? 'pref' : 'core';
      if (PREF_CUE.test(text)) level = 'pref';
      else if (REQ_CUE.test(text)) level = 'req';

      const yrs = [];
      const yre = /(\d{1,2})\s*(?:\+|plus)?\s*(?:[-–]\s*(\d{1,2})\s*)?(?:years?|yrs?)\b/gi;
      let m;
      while ((m = yre.exec(text))) yrs.push(+m[1]);
      if (yrs.length && (f0.size || /experience|exp\b|background/i.test(text))) {
        const y = Math.max.apply(null, yrs);
        if (f0.size) f0.forEach(function (n, name) { skillYears[name] = Math.max(skillYears[name] || 0, y); });
        else generalYears.push(y);
      }
      if (!PREF_CUE.test(text) && /\b(degree|bachelor|bachelors|bachelor's|b\.?sc|b\.?eng|master|masters|master's|m\.?sc|ph\.?d|doctorate|diploma|hnd)\b/i.test(text)) {
        const lv = eduLevelOf(text, false);
        if (lv > eduNeed) { eduNeed = lv; eduEquiv = EQUIV.test(text); }
      }

      f0.forEach(function (n, name) {
        const a = agg[name] || (agg[name] = { name: name, cat: BY[name].cat, level: level, count: 0, ctx: '' });
        a.count += n;
        if (rank[level] > rank[a.level]) { a.level = level; a.ctx = clip(text, 150); }
        if (!a.ctx) a.ctx = clip(text, 150);
      });
    });

    titleFound.forEach(function (n, name) {
      const a = agg[name] || (agg[name] = { name: name, cat: BY[name].cat, level: 'req', count: 1, ctx: clip(titleLine, 150) });
      a.level = 'req';
    });
    Object.keys(agg).forEach(function (k) { if (agg[k].level === 'core' && agg[k].count >= 3) agg[k].level = 'req'; });

    return {
      skills: Object.keys(agg).map(function (k) { return agg[k]; }),
      skillYears: skillYears,
      needYears: generalYears.length ? Math.max.apply(null, generalYears) : null,
      eduNeed: eduNeed, eduEquiv: eduEquiv,
      seniority: seniorityOf(jd),
      title: titleLine.length <= 100 ? titleLine : ''
    };
  }

  /* ---------- reading the CV ---------- */
  function cvDocs(d) {
    const docs = [];
    const add = function (sec, label, text, extra) {
      if (!String(text || '').trim()) return;
      const r = findSkills(text);
      docs.push(Object.assign({ sec: sec, label: label, text: String(text).trim(), found: r.found, rest: r.rest }, extra || {}));
    };
    add('summary', 'Headline', d.title);
    add('summary', 'Summary', d.summary);
    on(d.skills).forEach(function (s) { add('skills', s.label || 'Skills', s.items); });
    on(d.exp).forEach(function (e, i) {
      const lab = [e.role, e.org].filter(Boolean).join(' at ');
      add('exp', lab, e.role, { ei: i, role: true });
      L(e.b).forEach(function (b) { add('exp', lab, b, { ei: i, bullet: true }); });
    });
    on(d.proj).forEach(function (p, i) {
      add('proj', p.name, (p.name || '') + ' ' + (p.tech || ''), { pi: i, tech: true });
      L(p.b).forEach(function (b) { add('proj', p.name, b, { pi: i, bullet: true }); });
    });
    on(d.edu).forEach(function (e) { add('edu', e.degree, (e.degree || '') + ' ' + (e.b || '')); });
    on(d.awards).forEach(function (a) { add('edu', a.text, a.text); });
    return docs;
  }

  function evidence(docs, d, now) {
    const ev = {};
    const exps = on(d.exp);
    docs.forEach(function (doc) {
      doc.found.forEach(function (n, name) {
        const e = ev[name] || (ev[name] = { name: name, pro: 0, projB: 0, projT: 0, list: 0, where: { pro: [], proj: [], list: [] }, ei: new Set() });
        const push = function (k, lab) { if (lab && e.where[k].indexOf(lab) < 0) e.where[k].push(lab); };
        if (doc.sec === 'exp') { e.pro++; e.ei.add(doc.ei); push('pro', doc.label); }
        else if (doc.sec === 'proj') { if (doc.tech) e.projT++; else e.projB++; push('proj', doc.label); }
        else { e.list++; push('list', doc.sec === 'skills' ? 'Skills section' : doc.sec === 'summary' ? 'Headline/summary' : 'Education/awards'); }
      });
    });
    Object.keys(ev).forEach(function (k) {
      const e = ev[k];
      if (e.pro >= 2 || (e.pro >= 1 && (e.projB + e.projT) >= 1)) { e.score = 1; e.kind = 'pro'; }
      else if (e.pro === 1) { e.score = 0.9; e.kind = 'pro'; }
      else if (e.projB >= 2) { e.score = 0.75; e.kind = 'proj'; }
      else if (e.projB === 1) { e.score = e.projT ? 0.7 : 0.65; e.kind = 'proj'; }
      else if (e.projT >= 1) { e.score = 0.5; e.kind = 'proj'; }
      else { e.score = 0.35; e.kind = 'list'; }
      e.bullets = e.pro + e.projB;
      e.whereList = e.where.pro.concat(e.where.proj, e.where.list).slice(0, 3);
      e.months = unionMonths(Array.from(e.ei).map(function (i) { return parseRange(exps[i] && exps[i].dates, now); }));
    });
    return ev;
  }

  function resolve(name, ev) {
    let best = { score: 0, kind: 'none', type: 'none', where: [] };
    const d = ev[name];
    if (d) best = { score: d.score, kind: d.kind, type: 'direct', where: d.whereList, months: d.months, bullets: d.bullets };
    Object.keys(ev).forEach(function (k) {
      if (k === name) return;
      if (closure(k).has(name)) {
        const sc = ev[k].score * 0.9;
        if (sc > best.score) best = { score: sc, kind: ev[k].kind, type: 'implied', via: k, where: ev[k].whereList };
      }
    });
    const rel = BY[name].related;
    Object.keys(rel).forEach(function (k) {
      if (ev[k]) {
        const sc = ev[k].score * rel[k];
        if (sc > best.score) best = { score: sc, kind: 'related', type: 'related', via: k, where: ev[k].whereList };
      }
    });
    return best;
  }

  /* ---------- achievement quality ---------- */
  const STRONG = ['built', 'build', 'develop', 'design', 'implement', 'led', 'lead', 'optimi', 'reduc', 'increas', 'automat', 'deliver', 'integrat', 'migrat', 'architect', 'launch', 'improv', 'deploy', 'creat', 'engineer', 'refactor', 'streamlin', 'resolv', 'establish', 'spearhead', 'drove', 'drive', 'orchestrat', 'scal', 'secur', 'boost', 'accelerat', 'transform', 'enhanc', 'upgrad', 'ship', 'introduc', 'analy', 'generat', 'enabl', 'conduct', 'configur', 'validat', 'investigat', 'execut', 'train', 'wrote', 'write', 'modernis', 'standardis', 'standardiz', 'consolidat', 'simplif'];
  const WEAK_OPEN = /^(responsible for|worked on|worked with|helped|assisted|involved in|participated in|tasked with|duties (?:included|include)|in charge of|handled|dealt with|exposure to|various|etc)/i;
  const OUTCOME = /\b(reduc\w*|improv\w*|increas\w*|enabl\w*|result(?:ing|ed)?|ensur\w*|so that|sav(?:ing|ed|es)|boost\w*|cut|accelerat\w*|streamlin\w*|faster|speed\w*|eliminat\w*|achiev\w*|allow(?:ing|ed)|to (?:improve|reduce|increase|support|enable|ensure|simplify|automate|monitor|track))\b/i;
  const METRIC = /(^|[^a-z0-9.])(\d[\d,]*(?:\.\d+)?)(\s?(%|\+|k\b|m\b|x\b|ms\b|hrs?\b|hours?\b|days?\b|weeks?\b|months?\b|users?\b|clients?\b|customers?\b|games?\b|apps?\b|projects?\b|modules?\b|endpoints?\b|records?\b|requests?\b|tests?\b|screens?\b|pages?\b|teams?\b|stakeholders?\b|people\b))?/gi;

  function hasMetric(rest) {
    let m;
    METRIC.lastIndex = 0;
    while ((m = METRIC.exec(rest))) {
      const num = m[2], unit = m[4];
      if (/^(19|20)\d{2}$/.test(num) && !unit) continue;
      return true;
    }
    return false;
  }

  function bulletQuality(doc) {
    const text = doc.text, w = words(text), flags = [];
    let s = 0;
    const first = (text.match(/^[A-Za-z]+/) || [''])[0].toLowerCase();
    if (WEAK_OPEN.test(text)) flags.push('weak opener');
    else if (first && STRONG.some(function (v) { return first.indexOf(v) === 0; })) s += 25;
    else { s += 10; flags.push('opener could be stronger'); }
    if (hasMetric(doc.rest)) s += 25; else flags.push('no number or scale');
    if (OUTCOME.test(text)) s += 20; else flags.push('no outcome stated');
    if (doc.found.size) s += 15; else flags.push('no technology named');
    if (w >= 8 && w <= 30) s += 15;
    else if ((w >= 5 && w < 8) || (w > 30 && w <= 40)) { s += 8; flags.push(w < 8 ? 'very short' : 'long'); }
    else flags.push(w < 5 ? 'too short' : 'too long');
    return { score: s, flags: flags, words: w };
  }

  function achievements(docs) {
    const items = docs.filter(function (x) { return x.bullet; }).map(function (x) {
      const q = bulletQuality(x);
      return { section: x.sec, label: x.label, text: x.text, score: q.score, flags: q.flags, w: x.sec === 'exp' ? 2 : 1, metric: q.flags.indexOf('no number or scale') < 0 };
    });
    if (!items.length) return { score: null, total: 0, withMetric: 0, weakest: [] };
    const tw = items.reduce(function (a, b) { return a + b.w; }, 0);
    const score = Math.round(items.reduce(function (a, b) { return a + b.score * b.w; }, 0) / tw);
    const weakest = items.filter(function (x) { return x.score < 75; }).sort(function (a, b) { return (a.score - b.score) || (b.w - a.w); }).slice(0, 6);
    return { score: score, total: items.length, withMetric: items.filter(function (x) { return x.metric; }).length, weakest: weakest };
  }

  /* ---------- ATS hygiene ---------- */
  const PLACEHOLDER = /(\[[^\]]{2,}\]|lorem ipsum|MM\/YYYY|\bYYYY\b|Job Title|Company Name|Degree Name|University Name|Project Name|Replace this)/;
  const STOPW = new Set(['and', 'the', 'for', 'of', 'in', 'at', 'a', 'an', 'to', 'senior', 'junior', 'lead', 'principal', 'staff', 'sr', 'jr', 'associate', 'intern', 'trainee', 'graduate']);
  function atsChecks(d, jdRole, now) {
    const checks = [];
    const add = function (ok, label, tip) { checks.push({ ok: !!ok, label: label, tip: ok ? '' : tip }); };
    add(d.name && d.email && d.phone && d.loc, 'Contact details complete (name, email, phone, location)', 'Add the missing contact detail. Recruiters and ATS parsers look for all four.');
    add(/https?:\/\/|linkedin\.com|github\.com|\.[a-z]{2,}\//i.test(d.links || ''), 'At least one profile or portfolio link', 'Add your LinkedIn, GitHub or portfolio as a full URL.');
    const sw = words(d.summary);
    add(sw >= 25 && sw <= 110, 'Summary is 25 to 110 words (' + sw + ' now)', 'Aim for 2 to 4 sentences that mirror the role you are applying for.');
    add(on(d.skills).length >= 1, 'Skills section present', 'Add at least one skills category.');
    const exps = on(d.exp);
    add(exps.length >= 1, 'Work experience present', 'Add your work experience or internships.');
    const bad = exps.filter(function (e) { return !parseRange(e.dates, now); });
    add(exps.length === 0 || bad.length === 0, 'Dates on every role can be read (use MM/YYYY - MM/YYYY)', 'Fix the dates on: ' + bad.map(function (e) { return e.role || 'a role'; }).join(', ') + '. ATS systems calculate experience from them.');
    add(on(d.edu).length >= 1, 'Education present', 'Add your education.');
    const thin = exps.filter(function (e) { return L(e.b).length < 2; });
    add(exps.length === 0 || thin.length === 0, 'Every role has at least 2 bullets', 'Add bullets to: ' + thin.map(function (e) { return e.role || 'a role'; }).join(', ') + '.');
    const plain = cvPlain(d);
    add(!PLACEHOLDER.test(plain), 'No template placeholders left in the CV', 'Replace the leftover template text, such as [brackets], "Job Title" or "MM/YYYY".');
    add(words(plain) <= 950, 'Length fits about two pages (' + words(plain) + ' words)', 'Trim older or less relevant items; switch some projects off.');
    if (jdRole) {
      const toks = function (s) { return String(s).toLowerCase().split(/[^a-z0-9+#.]+/).filter(function (x) { return x.length > 2 && !STOPW.has(x); }); };
      const a = toks(d.title), b = toks(jdRole);
      add(b.length === 0 || a.some(function (x) { return b.indexOf(x) >= 0; }), 'Headline echoes the target role ("' + clip(jdRole, 40) + '")', 'Adjust your headline so it uses the same job-title words as the posting, if they are true for you.');
    }
    const ok = checks.filter(function (c) { return c.ok; }).length;
    return { score: Math.round(ok / checks.length * 100), checks: checks };
  }

  /* ---------- plain-text CV (for ATS paste, and for the AI prompt) ---------- */
  function cvPlain(d) {
    const out = [d.name, d.title, [d.email, d.phone, d.loc].filter(Boolean).join(' | '), L(d.links).join(' | '), ''];
    if (d.summary) out.push('PROFESSIONAL SUMMARY', d.summary, '');
    if (on(d.skills).length) { out.push('TECHNICAL SKILLS'); on(d.skills).forEach(function (s) { out.push(s.label + ': ' + s.items); }); out.push(''); }
    if (on(d.exp).length) {
      out.push('PROFESSIONAL EXPERIENCE');
      on(d.exp).forEach(function (e) { out.push(e.role + ' | ' + [e.org, e.loc].filter(Boolean).join(', ') + ' | ' + e.dates); L(e.b).forEach(function (b) { out.push('- ' + b); }); out.push(''); });
    }
    if (on(d.proj).length) {
      out.push('PROJECTS');
      on(d.proj).forEach(function (p) { out.push(p.name + ' | ' + p.tech + ' | ' + p.dates); L(p.b).forEach(function (b) { out.push('- ' + b); }); out.push(''); });
    }
    if (on(d.edu).length) { out.push('EDUCATION'); on(d.edu).forEach(function (e) { out.push(e.degree + ' | ' + e.school + ' | ' + e.dates + (e.b ? ' | ' + L(e.b).join('; ') : '')); }); out.push(''); }
    if (on(d.awards).length) { out.push('AWARDS'); on(d.awards).forEach(function (a) { out.push('- ' + a.text + (a.dates ? ' | ' + a.dates : '')); }); }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------- the analysis ---------- */
  function verdictFor(score, mustMissing) {
    let v;
    if (score >= 80) v = { key: 'strong', label: 'Strong match', advice: 'Apply. Tailor the summary and top bullets to the posting’s wording, then send.' };
    else if (score >= 65) v = { key: 'good', label: 'Good match', advice: 'Worth applying. Close the gaps below with true, specific details before you send.' };
    else if (score >= 50) v = { key: 'stretch', label: 'Stretch', advice: 'You can apply, but expect strong competition. Tailor carefully and be honest about the gaps.' };
    else v = { key: 'weak', label: 'Weak match', advice: 'Several core requirements are missing. Weigh whether the time is better spent on closer matches.' };
    if (mustMissing >= 3 && (v.key === 'strong' || v.key === 'good')) v = { key: 'stretch', label: 'Stretch', advice: 'Your overall score is decent, but several must-have skills are missing. Tailor carefully and be honest about the gaps.' };
    return v;
  }

  function analyze(d, now) {
    now = now || new Date();
    const docs = cvDocs(d);
    const ach = achievements(docs);
    const jd = String(d.jd || '').trim();
    const parsed = jd ? parseJD(jd) : null;
    const jdRole = parsed ? (d.cl && d.cl.role) || parsed.title : (d.cl && d.cl.role) || '';
    const ats = atsChecks(d, jd ? jdRole : '', now);
    const exps = on(d.exp);
    const haveMonths = unionMonths(exps.map(function (e) { return parseRange(e.dates, now); }));
    const out = { hasJD: !!jd, ach: ach, ats: ats, haveYears: r1(haveMonths / 12), cvWords: words(cvPlain(d)) };
    if (!jd) return out;

    const ev = evidence(docs, d, now);
    const W = { req: 3, core: 2, pref: 1 };
    const reqs = parsed.skills.map(function (s) {
      const res = resolve(s.name, ev);
      const need = parsed.skillYears[s.name];
      if (need && res.type === 'direct' && res.kind === 'pro' && res.months) {
        const have = res.months / 12;
        res.yearsNeed = need; res.yearsHave = r1(have);
        if (have < need) res.score *= (0.7 + 0.3 * (have / need));
      } else if (need) { res.yearsNeed = need; }
      return Object.assign({}, s, { ev: res, weight: W[s.level] });
    });
    const rank = { req: 3, core: 2, pref: 1 };
    reqs.sort(function (a, b) { return (rank[b.level] - rank[a.level]) || (b.count - a.count) || a.name.localeCompare(b.name); });

    const hard = reqs.filter(function (x) { return x.cat !== 'Soft skills'; });
    const mustList = hard.filter(function (x) { return x.level === 'req' || x.level === 'core'; });
    const prefList = hard.filter(function (x) { return x.level === 'pref'; });
    const soft = reqs.filter(function (x) { return x.cat === 'Soft skills'; });
    const wavg = function (list) { const tw = list.reduce(function (a, b) { return a + b.weight; }, 0); return tw ? list.reduce(function (a, b) { return a + b.ev.score * b.weight; }, 0) / tw : null; };
    const mustS = wavg(mustList), prefS = wavg(prefList);
    const covered = function (l) { return l.filter(function (x) { return x.ev.score >= 0.6; }).length; };
    const comps = [];
    comps.push({ key: 'must', label: 'Must-have skills', weight: 45, score: mustS === null ? null : Math.round(mustS * 100), note: mustList.length ? covered(mustList) + ' of ' + mustList.length + ' clearly shown in your CV' : 'No required skills recognised in the posting' });
    comps.push({ key: 'pref', label: 'Nice-to-have skills', weight: 10, score: prefS === null ? null : Math.round(prefS * 100), note: prefList.length ? covered(prefList) + ' of ' + prefList.length + ' covered' : 'None listed' });

    let expScore = null, expNote = '';
    const sen = parsed.seniority;
    if (parsed.needYears || sen) {
      const need = parsed.needYears || 0;
      let s = need ? Math.min(1, out.haveYears / need) : 1;
      if (sen && sen.min > out.haveYears + 1) s *= 0.8;
      expScore = Math.round(s * 100);
      expNote = (need ? 'Posting asks for ' + need + '+ years; your CV shows ' + out.haveYears + '. ' : '') + (sen ? sen.label + '.' : '');
    }
    comps.push({ key: 'exp', label: 'Experience level', weight: 15, score: expScore, note: expNote || 'No years or level stated' });
    comps.push({ key: 'ach', label: 'Achievement quality', weight: 15, score: ach.score, note: ach.total ? ach.withMetric + ' of ' + ach.total + ' bullets show a measurable result' : 'No bullets found' });

    let eduScore = null, eduNote = 'No degree requirement stated';
    if (parsed.eduNeed) {
      let have = 0;
      on(d.edu).forEach(function (e) { have = Math.max(have, eduLevelOf(e.degree + ' ' + (e.b || ''), /present|current|ongoing/i.test(e.dates || ''))); });
      let s = Math.min(1, have / parsed.eduNeed);
      if (parsed.eduEquiv) s = Math.max(s, 0.75);
      eduScore = Math.round(s * 100);
      eduNote = have >= parsed.eduNeed ? 'Meets the stated education level' : 'Below the stated level' + (parsed.eduEquiv ? ' (posting accepts equivalent experience)' : '');
    }
    comps.push({ key: 'edu', label: 'Education', weight: 5, score: eduScore, note: eduNote });
    comps.push({ key: 'ats', label: 'ATS-readiness of your CV', weight: 10, score: ats.score, note: ats.checks.filter(function (c) { return !c.ok; }).length + ' issue(s) found' });

    const active = comps.filter(function (c) { return c.score !== null; });
    const tw = active.reduce(function (a, b) { return a + b.weight; }, 0);
    const overall = tw ? Math.round(active.reduce(function (a, b) { return a + b.score * b.weight; }, 0) / tw) : 0;
    const mustMissing = mustList.filter(function (x) { return x.level === 'req' && x.ev.score < 0.3; }).length;
    const verdict = verdictFor(overall, mustMissing);

    /* what to do next, most useful first */
    const actions = [];
    mustList.filter(function (x) { return x.ev.score < 0.3; }).slice(0, 4).forEach(function (x) {
      const rel = Object.keys(BY[x.name].related).filter(function (k) { return ev[k]; })[0];
      actions.push({ tone: 'gap', text: x.name + ' is asked for' + (x.level === 'req' ? ' as a requirement' : '') + ' but is not in your CV.' + (rel ? ' You have ' + rel + '; if you have genuinely used ' + x.name + ' too, add it to a project or role bullet. If not, say so honestly in the cover letter and name ' + rel + ' as the closest experience.' : ' Only add it if you have really used it, ideally in a project or role bullet. Otherwise leave it out.') });
    });
    mustList.filter(function (x) { return x.ev.score >= 0.3 && x.ev.score < 0.6 && x.ev.type === 'direct' && !x.ev.bullets; }).slice(0, 3).forEach(function (x) {
      actions.push({ tone: 'weak', text: x.name + ' is only named in a skills or tech list, never in a bullet. Add a bullet in a role or project that shows what you built with it.' });
    });
    Object.keys(parsed.skillYears).forEach(function (n) {
      const r = reqs.filter(function (x) { return x.name === n; })[0];
      if (r && r.ev.yearsHave !== undefined && r.ev.yearsHave < r.ev.yearsNeed) actions.push({ tone: 'weak', text: 'The posting wants ' + r.ev.yearsNeed + '+ years of ' + n + '. Roles mentioning it add up to ' + r.ev.yearsHave + '. Say plainly how long you have used it, including project time.' });
    });
    if (parsed.needYears && out.haveYears < parsed.needYears) actions.push({ tone: 'weak', text: 'The posting asks for ' + parsed.needYears + '+ years of experience and your CV shows ' + out.haveYears + '. Make sure freelance and internship dates are included if they count.' });
    if (ach.total && ach.withMetric < Math.ceil(ach.total / 2)) actions.push({ tone: 'tip', text: 'Only ' + ach.withMetric + ' of ' + ach.total + ' bullets show a number or scale. Add real figures (users, records, time saved, tests, screens) where you know them. Do not invent numbers.' });
    ats.checks.filter(function (c) { return !c.ok; }).slice(0, 3).forEach(function (c) { actions.push({ tone: 'tip', text: c.tip }); });

    Object.assign(out, {
      overall: overall, verdict: verdict, components: comps, reqs: reqs, must: mustList, pref: prefList, soft: soft,
      experience: { have: out.haveYears, need: parsed.needYears, seniority: sen },
      education: { need: parsed.eduNeed, note: eduNote },
      role: jdRole, actions: actions.slice(0, 7)
    });
    return out;
  }

  /* ---------- detect job details from pasted text ---------- */
  const SOURCES = [['linkedin', 'LinkedIn'], ['indeed', 'Indeed'], ['glassdoor', 'Glassdoor'], ['bayt', 'Bayt'], ['naukri', 'Naukri'], ['gulftalent', 'GulfTalent'], ['workable', 'Workable'], ['lever.co', 'Lever'], ['greenhouse', 'Greenhouse'], ['ashbyhq', 'Ashby'], ['wellfound', 'Wellfound'], ['ikman', 'ikman.lk'], ['topjobs', 'TopJobs'], ['xpress', 'Xpress.lk']];
  function detectJob(jd) {
    const t = String(jd || '');
    const lines = t.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    const out = { company: '', role: '', location: '', mode: '', salary: '', link: '', source: '' };
    const lab = function (names) {
      const re = new RegExp('^(?:' + names + ')\\s*[:\\-–]\\s*(.{2,80})$', 'i');
      for (let i = 0; i < Math.min(lines.length, 40); i++) { const m = re.exec(lines[i]); if (m) return m[1].trim(); }
      return '';
    };
    out.role = lab('job title|position|role|vacancy|title') || '';
    if (!out.role && lines[0] && lines[0].length <= 80 && !/^(about|we are|we're|company|location)/i.test(lines[0])) out.role = lines[0];
    out.role = out.role.replace(/\s*\((?:m\/f\/d|f\/m\/d|all genders|remote|hybrid)[^)]*\)\s*/ig, ' ').replace(/\s+at\s+.+$/i, function (x) { return x; }).trim();
    const atm = /^(.{3,70}?)\s+(?:at|@)\s+([A-Z][^|,\n]{1,50})$/.exec(lines[0] || '');
    if (atm) { out.role = atm[1].trim(); out.company = atm[2].trim(); }
    out.company = out.company || lab('company|employer|organisation|organization|company name');
    if (!out.company) {
      for (let i = 0; i < Math.min(lines.length, 30); i++) {
        const m = /^[Aa]bout\s+(?!(?:us|the|you|our|this|your|that|them)\b)([A-Z][A-Za-z0-9&.' -]{1,40})$/.exec(lines[i]);
        if (m) { out.company = m[1].trim(); break; }
        const j = /^[Jj]oin\s+(?!(?:us|our|the|a|an)\b)([A-Z][A-Za-z0-9&.' -]{1,40}?)(?:[!,.]| as | and | to |$)/.exec(lines[i]);
        if (j) { out.company = j[1].trim(); break; }
      }
    }
    out.location = lab('location|based in|office|city|work location');
    if (/(fully|100%)\s*remote|remote[- ]first/i.test(t)) out.mode = 'Remote';
    else if (/\bhybrid\b/i.test(t)) out.mode = 'Hybrid';
    else if (/\bon-?site\b|in[- ]office|office-based/i.test(t)) out.mode = 'On-site';
    else if (/\bremote\b/i.test(t)) out.mode = 'Remote';
    const cur = '(?:AED|USD|EUR|GBP|LKR|INR|SAR|QAR|CAD|AUD|SGD|\\$|£|€)';
    const num = '\\d[\\d,.]*\\s?[kK]?';
    const sal = new RegExp(cur + '\\s?' + num + '(?:\\s?(?:-|–|to)\\s?' + cur + '?\\s?' + num + ')?(?:\\s?(?:per|/|a)\\s?(?:month|year|annum|hour|mo|yr))?', 'i').exec(t);
    if (sal) out.salary = sal[0].trim();
    const url = /https?:\/\/[^\s)>"']+/i.exec(t);
    if (url) { out.link = url[0].replace(/[.,;]+$/, ''); out.source = sourceOf(out.link); }
    return out;
  }
  function sourceOf(link) {
    const l = String(link || '').toLowerCase();
    for (let i = 0; i < SOURCES.length; i++) if (l.indexOf(SOURCES[i][0]) >= 0) return SOURCES[i][1];
    try { return new URL(/^https?:/i.test(link) ? link : 'https://' + link).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  /* ---------- prompt for an AI review (used by "Run AI review" and "Copy prompt") ---------- */
  function aiPrompt(d) {
    return [
      'You are a senior technical recruiter and ATS specialist. Review how well the CV below fits the job description. Be specific, honest and practical.',
      '',
      'Rules:',
      '- Use ONLY facts that are in the CV. Never invent experience, tools, numbers or achievements.',
      '- Where you suggest a rewrite, write it as a draft and mark any figure the candidate must supply as [add real number].',
      '- Distinguish clearly between must-have and nice-to-have requirements.',
      '- Treat closely related technologies sensibly (for example MySQL experience is partial evidence for PostgreSQL) and say so.',
      '',
      'Respond with these sections, in this order, using short paragraphs and bullet points:',
      '## Overall suitability',
      'A score out of 100, a one-line verdict, and the two or three reasons that drive it.',
      '## Requirements check',
      'For each must-have and nice-to-have requirement: Strong / Some / Weak / Missing, with a short quote or pointer to the evidence in the CV. Say whether the evidence comes from paid work, a project, or only a skills list.',
      '## Experience and seniority',
      'Compare the years and level asked with what the CV shows.',
      '## Weakest bullets',
      'The five weakest achievement bullets and a better draft for each, without inventing facts.',
      '## Gaps and honest advice',
      'What is genuinely missing, what can be addressed truthfully in the CV or cover letter, and what cannot.',
      '## Quick edits',
      'Up to five edits to the headline, summary or skills that mirror the posting’s wording where it is true.',
      '',
      '=== JOB DESCRIPTION ===',
      (d.cl && d.cl.role ? 'Role: ' + d.cl.role + '\n' : '') + (d.cl && d.cl.company ? 'Company: ' + d.cl.company + '\n' : '') + String(d.jd || '').trim(),
      '',
      '=== CV ===',
      cvPlain(d)
    ].join('\n');
  }

  root.Analyzer = {
    analyze: analyze, detectJob: detectJob, sourceOf: sourceOf, aiPrompt: aiPrompt, cvPlain: cvPlain,
    parseRange: parseRange, unionMonths: unionMonths, findSkills: findSkills, parseJD: parseJD, bulletQuality: bulletQuality,
    _tax: { SK: SK, BY: BY, GROUPS: GROUPS }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Analyzer;
})(typeof window !== 'undefined' ? window : globalThis);
