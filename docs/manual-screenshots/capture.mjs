/**
 * Capture real DensCare screenshots via Chrome DevTools Protocol.
 * Node 22 (global fetch + WebSocket) + headless Chrome.
 *
 * Usage: node capture.mjs <access-token>
 * Saves PNGs next to this script.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const DEBUG_PORT = 9222;
const PROFILE = `C:\\tmp\\denscare-cdp-profile-${Date.now()}`;

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error('usage: node capture.mjs <token>');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// IDs (from the live database)
const PATIENT = 'e920be7e-c4ef-4fda-b990-65f13a04c9a6';
const RECORD = '061385e3-1ebb-4953-82c1-41bd0dba8595';
const PLAN = '6b07a9dd-3f80-474a-9f78-c6c39a25dcad';
const INVOICE = '2abe60c4-26b2-4cfc-9b41-aa46e5a74b85';
const PAYMENT = '8d1fa94e-b3be-4053-b09c-1d48cd2b4bfc';
const RECEIPT = 'bb166833-66fc-406b-b5e2-912e9e4018c8';

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--window-size=1440,1000',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  `${BASE}/auth/login`,
], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(300);
  }
  throw new Error('Chrome DevTools endpoint not reachable');
}

function connect(wsUrl) {
  return new Promise((resolveFn, rejectFn) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 0;
    const pending = new Map();
    ws.onopen = () => resolveFn({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const id = ++nextId;
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      close: () => ws.close(),
    });
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      }
    };
    ws.onerror = rejectFn;
  });
}

async function evalJs(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result?.value;
}

/** Poll until `expr` evaluates truthy, then return its value. */
async function waitFor(cdp, expr, desc, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await evalJs(cdp, expr);
    if (v) return v;
    await sleep(500);
  }
  throw new Error(`timeout waiting for: ${desc}`);
}

/** Navigate and wait until location.pathname matches the expected prefix. */
async function nav(cdp, url, pathPrefix, wait = 4000) {
  await cdp.send('Page.navigate', { url });
  await sleep(wait);
  if (pathPrefix) {
    try {
      await waitFor(cdp, `location.pathname.startsWith(${JSON.stringify(pathPrefix)})`,
        `path ${pathPrefix}`, 20000);
    } catch (e) {
      const actual = await evalJs(cdp, 'location.pathname');
      console.warn(`  !! expected ${pathPrefix} but on ${actual}`);
      throw e;
    }
  }
}

async function shot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  writeFileSync(join(OUT_DIR, name), Buffer.from(data, 'base64'));
  console.log('saved', name);
}

/** Click a tab (button[role="tab"]) whose text starts with the label. */
async function clickTab(cdp, label) {
  return evalJs(cdp, `(() => {
    const els = [...document.querySelectorAll('button[role="tab"]')];
    const el = els.find((e) => (e.textContent || '').trim().startsWith(${JSON.stringify(label)}) && e.offsetParent !== null);
    if (el) { el.click(); return el.textContent.trim(); }
    return null;
  })()`);
}

async function clickByTitle(cdp, substring) {
  return evalJs(cdp, `(() => {
    const els = [...document.querySelectorAll('[title]')];
    const el = els.find((e) => (e.getAttribute('title') || '').includes(${JSON.stringify(substring)}));
    if (el) { el.click(); return true; }
    return false;
  })()`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const wsUrl = await getWsUrl();
  const cdp = await connect(wsUrl);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });

  // 01 — login page (unauthenticated)
  await waitFor(cdp, `!!document.querySelector('button')`, 'login form renders', 15000);
  await sleep(1500);
  await shot(cdp, '01-login.png');

  // 02 — dashboard (inject token the same way "Remember me" persists it)
  await evalJs(cdp, `localStorage.setItem('denscare_access_token', ${JSON.stringify(TOKEN)}); location.href = '/dashboard';`);
  await waitFor(cdp, `document.querySelector('h1')?.textContent === 'Dashboard'`, 'dashboard h1', 25000);
  await sleep(2500); // let KPI data finish loading
  await shot(cdp, '02-dashboard.png');

  // 03 — patients list
  await nav(cdp, `${BASE}/patients`, '/patients');
  await sleep(1500);
  await shot(cdp, '03-patients.png');

  // 04 — patient profile
  await nav(cdp, `${BASE}/patients/${PATIENT}`, '/patients/');
  await sleep(1500);
  await shot(cdp, '04-patient-profile.png');

  // 05 — appointments
  await nav(cdp, `${BASE}/appointments`, '/appointments');
  await sleep(1500);
  await shot(cdp, '05-appointments.png');

  // 06 — patient records list
  await nav(cdp, `${BASE}/patient-records`, '/patient-records');
  await sleep(1500);
  await shot(cdp, '06-patient-records.png');

  // 07 — record detail (Clinical tab)
  await nav(cdp, `${BASE}/patient-records/${RECORD}`, '/patient-records/');
  await sleep(1500);
  await shot(cdp, '07-record-detail.png');

  // 08 — prescriptions tab, then the printable prescription
  const tab = await clickTab(cdp, 'Prescriptions');
  console.log('prescriptions tab:', tab ?? 'NOT FOUND');
  await sleep(2500);
  await shot(cdp, '08a-record-prescriptions-tab.png');
  const opened = await clickByTitle(cdp, 'Open the prescription');
  await sleep(2500);
  if (opened) {
    await shot(cdp, '08b-prescription-printable.png');
  } else {
    console.log('prescription drawer not opened');
  }

  // 09 — treatment plans list
  await nav(cdp, `${BASE}/treatment-plans`, '/treatment-plans');
  await sleep(1500);
  await shot(cdp, '09-treatment-plans.png');

  // 10 — treatment plan detail
  await nav(cdp, `${BASE}/treatment-plans/${PLAN}`, '/treatment-plans/');
  await sleep(1500);
  await shot(cdp, '10-treatment-plan-detail.png');

  // 11 — procedure catalogue
  await nav(cdp, `${BASE}/procedures`, '/procedures');
  await sleep(1500);
  await shot(cdp, '11-procedures.png');

  // 12 — doctors
  await nav(cdp, `${BASE}/doctors`, '/doctors');
  await sleep(1500);
  await shot(cdp, '12-doctors.png');

  // 13 — billing dashboard
  await nav(cdp, `${BASE}/billing`, '/billing');
  await sleep(1500);
  await shot(cdp, '13-billing-dashboard.png');

  // 14 — invoices list
  await nav(cdp, `${BASE}/billing/invoices`, '/billing/invoices');
  await sleep(1500);
  await shot(cdp, '14-invoices.png');

  // 15 — invoice detail
  await nav(cdp, `${BASE}/billing/invoices/${INVOICE}`, '/billing/invoices/');
  await sleep(1500);
  await shot(cdp, '15-invoice-detail.png');

  // 16 — payments list
  await nav(cdp, `${BASE}/billing/payments`, '/billing/payments');
  await sleep(1500);
  await shot(cdp, '16-payments.png');

  // 17 — payment detail
  await nav(cdp, `${BASE}/billing/payments/${PAYMENT}`, '/billing/payments/');
  await sleep(1500);
  await shot(cdp, '17-payment-detail.png');

  // 18 — receipt detail
  await nav(cdp, `${BASE}/billing/receipts/${RECEIPT}`, '/billing/receipts/');
  await sleep(1500);
  await shot(cdp, '18-receipt.png');

  // 19 — users list
  await nav(cdp, `${BASE}/users`, '/users');
  await sleep(1500);
  await shot(cdp, '19-users.png');

  // 20 — pending approvals
  await nav(cdp, `${BASE}/admin/users/pending`, '/admin/users/pending');
  await sleep(1500);
  await shot(cdp, '20-pending-approvals.png');

  // 21 — mobile (phone viewport) patients list
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  await nav(cdp, `${BASE}/patients`, '/patients');
  await sleep(1500);
  await shot(cdp, '21-mobile-patients.png');

  console.log('ALL DONE');
  await shutdown();
}

/** Close Chrome, wait for exit, then remove the profile dir (ignore errors). */
async function shutdown() {
  try {
    chrome.kill();
    await new Promise((r) => chrome.on('exit', r));
  } catch { /* already gone */ }
  try {
    rmSync(PROFILE, { recursive: true, force: true });
  } catch { /* profile lock can linger on Windows; harmless */ }
  process.exit(0);
}

main().catch(async (err) => {
  console.error('FAILED:', err.message);
  await shutdown();
  process.exit(1);
});
