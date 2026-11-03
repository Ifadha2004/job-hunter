# Job Hunter

A free, private job-search toolkit that runs entirely in your browser. No server, no sign-up, no build step.

- **CV builder**: ATS-friendly CV and cover letter, with saved versions per job. Print or save as PDF with clickable links.
- **Job fit analysis**: paste a job description and get a score, must-have vs nice-to-have requirements, how strongly your CV proves each one (work experience, project, skills list only, related tech), achievement-bullet quality and ATS checks. Optional AI review with your own Anthropic API key.
- **Applications tracker**: replaces your Excel sheet. Click **Mark as applied** in the builder and the job details are saved. Statuses, follow-up dates, search, filters, CSV import and export.

## Deploy
Upload everything (`index.html`, `css/`, `js/`) to a GitHub repo and import it in Vercel. Framework preset: **Other**. No build command.

## Privacy
All data is stored in each visitor's own browser (localStorage). Nothing is sent anywhere unless a visitor runs the optional AI review, which goes straight from their browser to Anthropic using their own key. Use **Data and settings > Back up everything** regularly, since clearing browser data erases it.

## Tech stack
Plain HTML, CSS and JavaScript on purpose: instant load, free hosting, nothing to break. Move to a framework plus a database only if you add accounts, cross-device sync or a shared AI key.

## Files
`js/analyzer.js` fit engine, `js/tracker-data.js` tracker logic and CSV, `js/core.js` storage, `js/builder.js` CV editor and preview, `js/fit.js` fit report and AI, `js/tracker.js` Applications view, `js/app.js` wiring.
