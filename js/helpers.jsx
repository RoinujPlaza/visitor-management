/* ==========================================================================
   VisitorPass — shared helpers and constants
   Loaded before every screen file. Globals are exported on `window`.
   ========================================================================== */

const { useState, useEffect, useCallback, useRef } = React;

let csrfToken = '';

async function fetchCsrf(force = false) {
  if (csrfToken && !force) return csrfToken;
  try {
    const r = await fetch('api/index.php?action=csrf', { credentials: 'same-origin' });
    const d = await r.json();
    csrfToken = d.token || '';
    const h = r.headers.get('X-CSRF-Token');
    if (h) csrfToken = h;
  } catch (e) { /* handled by the caller */ }
  return csrfToken;
}

async function api(action, body, query = '', opts = {}) {
  const { multipart = false, raw = false, _retried = false } = opts;
  await fetchCsrf();
  const url = `api/index.php?action=${action}${query ? '&' + query : ''}`;
  const init = { method: body || multipart ? 'POST' : 'GET', credentials: 'same-origin', headers: {} };
  if (csrfToken) init.headers['X-CSRF-Token'] = csrfToken;
  if (multipart) {
    init.body = body;
  } else if (body) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const h = res.headers.get('X-CSRF-Token');
  if (h) csrfToken = h;

  if (res.status === 419 && !_retried) {
    csrfToken = '';
    await fetchCsrf(true);
    return api(action, body, query, { ...opts, _retried: true });
  }
  if (!res.ok) {
    if (res.status === 401 && !['login', 'csrf'].includes(action)) window.onAuthLost();
    const data = await res.json().catch(() => ({}));
    const e = new Error(data.error || `Request failed (${res.status})`);
    e.status = res.status;
    throw e;
  }
  if (raw) return res;
  return res.json().catch(() => ({}));
}

const toDate = (s) => new Date(String(s).replace(' ', 'T'));
const fmt = (s) => s ? toDate(s).toLocaleString('en-PH', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}) : '—';
const fmtDate = (s) => s ? toDate(s).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const duration = (a, b) => {
  const m = Math.max(0, Math.floor(((b ? toDate(b) : new Date()) - toDate(a)) / 60000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};
const esc = (s) => new URLSearchParams(s || {}).toString();
const todayStr = () => new Date().toLocaleDateString('en-CA');

const ID_TYPES = ["Driver's License", 'Passport', 'UMID', 'PhilSys National ID', 'Company ID', "Voter's ID", 'Other'];
const PURPOSES = ['Meeting', 'Interview', 'Delivery', 'Maintenance / Repair', 'Inspection / Audit', 'Personal / Family', 'Other'];
const ROLES = ['admin', 'guard', 'reception'];
const EMPTY = {
  full_name: '', company: '', phone: '', email: '', id_type: '', id_number: '',
  purpose: '', host_name: '', host_id: '', department: '', notes: '',
};

// The app shell replaces this at startup so 401 responses can log the user out.
window.onAuthLost = () => {};

Object.assign(window, {
  useState, useEffect, useCallback, useRef,
  fetchCsrf, api, toDate, fmt, fmtDate, duration, esc, todayStr,
  ID_TYPES, PURPOSES, ROLES, EMPTY,
});
