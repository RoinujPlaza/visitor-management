# VisitorPass – Visitor Management System

React JS (frontend) + PHP API + SQLite database, running on XAMPP.
**No npm, no build step, and no internet required** — all JS libraries are bundled in `vendor/`.

## Run

1. Copy the whole `visitor-management` folder into `C:\xampp\htdocs\`
   (or just run `start.bat` — it copies the folder, starts Apache and opens the browser).
2. Open **XAMPP Control Panel** → start **Apache** (MySQL is not needed).
3. Open: http://localhost/visitor-management/

The SQLite database (`data/vms.sqlite`) is created and migrated automatically on first run.

### Default logins
| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin — full access, user management, reports, backup/restore |
| guard | guard123 | Guard — check-in/out, visitor list, badge, reports |
| reception | reception123 | Reception — also manages appointments and hosts |

Change the passwords in **Settings** after first login.

## Features

- **Login & access control** — session-based auth, roles, session timeout, login rate-limit, CSRF protection, audit log.
- **Dashboard** — currently inside, today's counts, expected visitors, 7-day chart, overstay warnings, quick check-out.
- **Visitor check-in** — auto badge number (e.g. `V261125-001`), collision-safe sequence, QR code, printable badge.
- **Visitor list** — search, status/host/date filters, pagination, edit, check-out, delete (admin), filter-aware CSV export.
- **Appointments** — pre-register expected visitors, edit/cancel, one-click check-in.
- **Host directory** — manage hosts/departments; autocomplete on check-in forms.
- **Kiosk mode** — look up by badge/QR/phone/ID and self check-out.
- **Reports** — date range, summary cards, daily chart, average visit duration, top hosts, purposes, printable report, CSV export.
- **Settings** — company name, badge prefix/footer, overstay threshold, session timeout, password change.
- **Backup & restore** — download a full SQLite snapshot or restore one (admin only; keeps a `.old` copy).
- **User management** — add/edit/disable users, change roles/passwords (admin only).
- **Audit log** — searchable record of sign-ins, check-ins/out, edits, deletes, exports and settings changes.

## Smoke test

With Apache running:

```
powershell -ExecutionPolicy Bypass -File smoke-test.ps1
```

This logs in as admin, creates a visitor, checks them out, exercises the new endpoints and cleans up.

## Troubleshooting

- **"could not find driver"** — enable `extension=pdo_sqlite` in `C:\xampp\php\php.ini` (remove leading `;`) and restart Apache.
- **Blank page / scripts not loading** — check that the `vendor/` folder was copied alongside `index.html`.
- **419 "Invalid CSRF token"** — refresh the page; the session token rotates on login.
- **429 "Too many failed attempts"** — wait 15 minutes (or clear the `login_attempts` table).
- `data/.htaccess` blocks direct browser access to the database file.

## Notes

- Requires PHP with `pdo_sqlite` (enabled by default in XAMPP).
- Dev-style frontend (Babel in the browser). For production you can build with Vite and serve the `dist` folder, but the app runs as-is.

## Structure
```
visitor-management/
├── index.html       # loads local React/Babel bundles + all JSX files in order
├── js/              # all React source files (in dependency order)
│   ├── icons.jsx        # SVG icon set
│   ├── helpers.jsx      # API client, CSRF, formatting helpers, constants
│   ├── ui.jsx           # shared UI (Modal, Pager, Empty, Loading)
│   ├── login.jsx        # login screen
│   ├── visitor-form.jsx # check-in form + printable QR badge
│   ├── dashboard.jsx    # dashboard screen
│   ├── checkin.jsx      # visitor check-in screen
│   ├── visitors.jsx     # visitor list screen
│   ├── appointments.jsx # appointments screen
│   ├── hosts.jsx        # host directory screen
│   ├── kiosk.jsx        # self-service kiosk screen
│   ├── reports.jsx      # reports screen
│   ├── users.jsx        # user management screen
│   ├── audit.jsx        # audit log screen
│   ├── settings.jsx     # settings, password, backup/restore screen
│   └── app.jsx          # app shell only (navigation + screen routing)
├── styles.css
├── vendor/          # React, ReactDOM, Babel, QRCode (offline)
├── api/index.php    # PHP API, migrations, auth, reports, backup
├── data/            # SQLite DB created here (denied by .htaccess)
├── start.bat        # one-click launcher (Windows/XAMPP)
└── smoke-test.ps1   # automated API check
```
