// Overnight build watcher. Polls GitHub Actions for Meetily-Extended every 5 min,
// writes BUILD_STATUS.md whenever state changes, exits when build settles
// (success or non-transient failure).

import { writeFileSync, appendFileSync } from 'node:fs';

const REPO = 'simranpalsinghrnm-sys/Meetily-Extended';
const TAG_PREFIX = 'v1.0.0-extended';
const STATUS_FILE = 'BUILD_STATUS.md';
const LOG_FILE = 'logs/poll-build.log';
const POLL_MS = 5 * 60_000;
const MAX_RUNTIME_MS = 6 * 60 * 60_000; // 6h hard cap

const started = Date.now();
let lastSnapshot = '';

const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try { appendFileSync(LOG_FILE, line); } catch {}
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'meetily-poll' },
  });
  if (!res.ok) throw new Error(`GH ${path} → ${res.status}`);
  return res.json();
}

async function snapshot() {
  const { workflow_runs } = await gh(`/repos/${REPO}/actions/runs?per_page=10`);
  const interesting = workflow_runs.filter(r => r.head_branch?.startsWith(TAG_PREFIX) || r.event === 'workflow_dispatch');
  const newest = interesting[0];
  if (!newest) return { state: 'no-runs', summary: 'No tag-triggered runs yet.' };

  const { jobs } = await gh(`/repos/${REPO}/actions/runs/${newest.id}/jobs`);
  const lines = [];
  lines.push(`# Build Status (auto-generated)\n`);
  lines.push(`Run ID: ${newest.id}`);
  lines.push(`Tag: ${newest.head_branch}`);
  lines.push(`URL: ${newest.html_url}`);
  lines.push(`Started: ${newest.created_at}`);
  lines.push(`Status: **${newest.status}** ${newest.conclusion ? `(${newest.conclusion})` : ''}`);
  lines.push('');
  lines.push('## Jobs');
  for (const j of jobs) {
    lines.push(`- **${j.name}** — ${j.status} ${j.conclusion ?? ''}`);
    for (const s of j.steps ?? []) {
      const tag = s.conclusion === 'failure' ? '❌' : s.conclusion === 'success' ? '✅' : '·';
      lines.push(`  ${tag} ${s.name} (${s.conclusion ?? s.status})`);
    }
  }
  lines.push('');
  lines.push(`_Updated: ${new Date().toISOString()}_`);

  const state = `${newest.status}:${newest.conclusion ?? '-'}`;
  return { state, summary: lines.join('\n'), run: newest };
}

async function main() {
  log('watcher started');
  while (Date.now() - started < MAX_RUNTIME_MS) {
    try {
      const snap = await snapshot();
      if (snap.summary !== lastSnapshot) {
        writeFileSync(STATUS_FILE, snap.summary);
        lastSnapshot = snap.summary;
        log(`snapshot updated: ${snap.state}`);
      }
      if (snap.state.startsWith('completed:')) {
        log(`build settled with state=${snap.state}, exiting`);
        // Append a final marker so the morning view is obvious
        appendFileSync(STATUS_FILE, `\n\n---\n\n## ✅ FINAL — watcher stopped at ${new Date().toISOString()}\n\n- Outcome: **${snap.state}**\n- ${snap.state === 'completed:success' ? 'Binaries are in the draft release: ' + (snap.run.html_url ?? '') : 'See failed steps above. Re-engage Claude in the morning to diagnose.'}\n`);
        return;
      }
    } catch (e) {
      log(`poll error: ${e.message}`);
    }
    await sleep(POLL_MS);
  }
  log('runtime cap hit — exiting');
  appendFileSync(STATUS_FILE, `\n\n---\n\n## ⏰ Watcher hit 6h cap at ${new Date().toISOString()} — re-engage to keep monitoring.\n`);
}

main().catch(e => { log(`fatal: ${e.message}`); process.exit(1); });
