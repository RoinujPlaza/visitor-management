<?php
declare(strict_types=1);

/* ========================================================================
   VisitorPass API — PHP + SQLite
   Single entry point. All responses are JSON.
   ======================================================================== */

date_default_timezone_set('Asia/Manila');

$secure = (!empty($_SERVER['HTTPS']) && strtolower($_SERVER['HTTPS']) !== 'off');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'domain'   => '',
    'secure'   => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

$dir = __DIR__ . '/../data';
if (!is_dir($dir)) { @mkdir($dir, 0777, true); }

$dbFile = $dir . '/vms.sqlite';
$pdo = new PDO('sqlite:' . $dbFile, null, null, [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('PRAGMA foreign_keys = ON');
$pdo->exec('PRAGMA busy_timeout = 5000');
$pdo->exec('PRAGMA journal_mode = WAL');

/* ---------------------------------------------------------------- helpers */

function out($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function fail(string $msg, int $code = 400): void
{
    out(['error' => $msg], $code);
}
function colExists(PDO $pdo, string $table, string $col): bool
{
    foreach ($pdo->query('PRAGMA table_info(' . $table . ')') as $r) {
        if ($r['name'] === $col) { return true; }
    }
    return false;
}
function addCol(PDO $pdo, string $table, string $col, string $def): void
{
    if (!colExists($pdo, $table, $col)) {
        $pdo->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $col . ' ' . $def);
    }
}
function setting(string $key, string $fallback = ''): string
{
    global $pdo;
    static $cache = [];
    if (!array_key_exists($key, $cache)) {
        $s = $pdo->prepare('SELECT value FROM settings WHERE key=?');
        $s->execute([$key]);
        $v = $s->fetchColumn();
        $cache[$key] = $v === false ? $fallback : (string)$v;
    }
    return $cache[$key];
}
function audit(string $action, string $entity = '', string $entityId = '', string $detail = '', ?array $user = null): void
{
    global $pdo, $me;
    $u = $user ?? $me ?? [];
    try {
        $s = $pdo->prepare('INSERT INTO audit_log(at,user_id,username,action,entity,entity_id,detail) VALUES(?,?,?,?,?,?,?)');
        $s->execute([
            date('Y-m-d H:i:s'), $u['id'] ?? null, $u['username'] ?? null,
            $action, $entity, $entityId, $detail,
        ]);
    } catch (Throwable $e) { /* logging must never break the request */ }
}
function can(array $me, string $perm): bool
{
    $role = $me['role'];
    if ($role === 'admin') { return true; }
    $guard = ['list', 'stats', 'checkin', 'checkout', 'edit', 'badge', 'lookup',
              'reports', 'hosts_view', 'appointments', 'appointments_checkin', 'export'];
    $reception = ['list', 'stats', 'checkin', 'checkout', 'badge', 'lookup',
                  'reports', 'hosts_view', 'appointments', 'appointments_manage',
                  'appointments_checkin', 'export'];
    return $role === 'guard' ? in_array($perm, $guard, true)
         : ($role === 'reception' && in_array($perm, $reception, true));
}
function need(array $me, string $perm): void
{
    if (!can($me, $perm)) { fail('You do not have permission for this action', 403); }
}
function body(): array
{
    static $in = null;
    if ($in === null) {
        $raw = file_get_contents('php://input');
        $in = json_decode($raw ?: '', true);
        if (!is_array($in)) { $in = []; }
    }
    return $in;
}
function str_(string $key, string $default = ''): string
{
    return trim((string)(body()[$key] ?? $default));
}
function now(): string { return date('Y-m-d H:i:s'); }

/* --------------------------------------------------------------- migration */

$pdo->exec("CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'guard'
)");
addCol($pdo, 'users', 'active', 'INTEGER NOT NULL DEFAULT 1');
addCol($pdo, 'users', 'created_at', 'TEXT');

$pdo->exec("CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  badge_no TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company TEXT, phone TEXT, email TEXT,
  id_type TEXT, id_number TEXT,
  purpose TEXT NOT NULL,
  host_name TEXT NOT NULL,
  department TEXT, notes TEXT,
  status TEXT NOT NULL DEFAULT 'in',
  check_in TEXT NOT NULL,
  check_out TEXT,
  created_by INTEGER
)");
addCol($pdo, 'visitors', 'host_id', 'INTEGER');
addCol($pdo, 'visitors', 'qr_token', 'TEXT');
addCol($pdo, 'visitors', 'expected_at', 'TEXT');
addCol($pdo, 'visitors', 'appointment_id', 'INTEGER');

$pdo->exec("CREATE TABLE IF NOT EXISTS badge_counters (day TEXT PRIMARY KEY, last INTEGER NOT NULL)");
$pdo->exec("CREATE TABLE IF NOT EXISTS hosts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department TEXT,
  phone TEXT,
  email TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT
)");
$pdo->exec("CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  company TEXT, phone TEXT, email TEXT,
  purpose TEXT NOT NULL,
  host_id INTEGER,
  host_name TEXT NOT NULL,
  department TEXT,
  expected_at TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  visitor_id INTEGER,
  created_by INTEGER,
  created_at TEXT
)");
$pdo->exec("CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  detail TEXT
)");
$pdo->exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
$pdo->exec("CREATE TABLE IF NOT EXISTS login_attempts (
  username TEXT NOT NULL,
  ip TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  PRIMARY KEY (username, ip)
)");

foreach ([
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_visitors_badge ON visitors(badge_no)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_visitors_qr ON visitors(qr_token)',
    'CREATE INDEX IF NOT EXISTS idx_visitors_checkin ON visitors(check_in)',
    'CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors(status)',
    'CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at)',
    'CREATE INDEX IF NOT EXISTS idx_appt_expected ON appointments(expected_at)',
] as $sql) {
    try { $pdo->exec($sql); } catch (Throwable $e) { /* tolerate legacy duplicate data */ }
}

$seed = $pdo->prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)");
foreach ([
    'company_name'        => 'VisitorPass',
    'badge_prefix'        => 'V',
    'overstay_minutes'    => '480',
    'session_timeout'     => '30',
    'badge_footer'        => 'Please wear this badge visibly at all times.',
] as $k => $v) { $seed->execute([$k, $v]); }

// Seed missing default accounts (also upgrades older databases that had only admin/guard).
$seedUser = $pdo->prepare('INSERT OR IGNORE INTO users(username,password_hash,full_name,role,active,created_at) VALUES(?,?,?,?,1,?)');
$seedUser->execute(['admin',     password_hash('admin123', PASSWORD_DEFAULT), 'Administrator', 'admin', now()]);
$seedUser->execute(['guard',     password_hash('guard123', PASSWORD_DEFAULT), 'Security Guard', 'guard', now()]);
$seedUser->execute(['reception', password_hash('reception123', PASSWORD_DEFAULT), 'Receptionist', 'reception', now()]);

/* ------------------------------------------------------------ csrf + input */

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(24));
}
header('X-CSRF-Token: ' . $_SESSION['csrf_token']);

$action = (string)($_GET['action'] ?? '');
$in     = body();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($token === '' || !hash_equals($_SESSION['csrf_token'], $token)) {
        fail('Invalid or missing CSRF token. Refresh the page and try again.', 419);
    }
}

/* -------------------------------------------------------- csrf / login flow */

if ($action === 'csrf') { out(['token' => $_SESSION['csrf_token']]); }

if ($action === 'login') {
    $username = trim((string)($in['username'] ?? ''));
    $password = (string)($in['password'] ?? '');
    $ip       = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');

    $s = $pdo->prepare('SELECT attempts, locked_until FROM login_attempts WHERE username=? AND ip=?');
    $s->execute([$username, $ip]);
    $attempt = $s->fetch();
    if ($attempt && $attempt['locked_until'] && strtotime($attempt['locked_until']) > time()) {
        fail('Too many failed attempts. Try again in ' . ceil((strtotime($attempt['locked_until']) - time()) / 60) . ' minute(s).', 429);
    }

    $s = $pdo->prepare('SELECT * FROM users WHERE username=?');
    $s->execute([$username]);
    $u = $s->fetch();

    if (!$u || !$u['active'] || !password_verify($password, $u['password_hash'])) {
        $tries = $attempt ? (int)$attempt['attempts'] + 1 : 1;
        $lock  = $tries >= 5 ? date('Y-m-d H:i:s', time() + 900) : null;
        $s = $pdo->prepare('INSERT INTO login_attempts(username,ip,attempts,locked_until) VALUES(?,?,?,?)
                            ON CONFLICT(username,ip) DO UPDATE SET attempts=excluded.attempts, locked_until=excluded.locked_until');
        $s->execute([$username, $ip, $tries, $lock]);
        audit('login_failed', 'user', $username, 'IP ' . $ip, ['id' => $u['id'] ?? null, 'username' => $u['username'] ?? $username]);
        fail('Invalid username or password', 401);
    }

    $pdo->prepare('DELETE FROM login_attempts WHERE username=? AND ip=?')->execute([$username, $ip]);
    session_regenerate_id(true);
    $_SESSION['uid'] = $u['id'];
    $_SESSION['last_activity'] = time();
    $user = [
        'id' => (int)$u['id'], 'username' => $u['username'],
        'full_name' => $u['full_name'], 'role' => $u['role'],
    ];
    audit('login', 'user', $u['username'], 'Signed in', $user);
    out(['user' => $user]);
}

if ($action === 'logout') {
    if (isset($_SESSION['uid'])) { audit('logout', 'user', (string)$_SESSION['uid']); }
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);
}

/* ------------------------------------------------------------- authentication */

if (!isset($_SESSION['uid'])) { fail('Unauthorized', 401); }

$timeout = max(5, (int)setting('session_timeout', '30')) * 60;
if (isset($_SESSION['last_activity']) && time() - (int)$_SESSION['last_activity'] > $timeout) {
    $_SESSION = [];
    session_destroy();
    fail('Session expired. Please sign in again.', 401);
}
$_SESSION['last_activity'] = time();

$s = $pdo->prepare("SELECT id,username,full_name,role FROM users WHERE id=? AND active=1");
$s->execute([$_SESSION['uid']]);
$me = $s->fetch();
$s = null;
if (!$me) { $_SESSION = []; session_destroy(); fail('Unauthorized', 401); }
$me['id'] = (int)$me['id'];

$allSettings = [];
$st = $pdo->query('SELECT key,value FROM settings');
foreach ($st->fetchAll() as $r) { $allSettings[$r['key']] = $r['value']; }
$st->closeCursor();
$st = null;

function visitorFilter(array $get, array &$params, string $alias = ''): string
{
    $a = $alias ? $alias . '.' : '';
    $w = [];
    if (!empty($get['q'])) {
        $like = '%' . $get['q'] . '%';
        $w[] = "({$a}full_name LIKE ? OR {$a}company LIKE ? OR {$a}host_name LIKE ? OR {$a}badge_no LIKE ? OR {$a}phone LIKE ? OR {$a}id_number LIKE ?)";
        array_push($params, $like, $like, $like, $like, $like, $like);
    }
    if (!empty($get['status']) && in_array($get['status'], ['in', 'out'], true)) {
        $w[] = "{$a}status = ?";
        $params[] = $get['status'];
    }
    if (!empty($get['from'])) { $w[] = "substr({$a}check_in,1,10) >= ?"; $params[] = $get['from']; }
    if (!empty($get['to']))   { $w[] = "substr({$a}check_in,1,10) <= ?"; $params[] = $get['to']; }
    if (!empty($get['host_id'])) { $w[] = "{$a}host_id = ?"; $params[] = (int)$get['host_id']; }
    return $w ? ' WHERE ' . implode(' AND ', $w) : '';
}

function nextBadge(PDO $pdo): string
{
    $day = date('ymd');
    $prefix = setting('badge_prefix', 'V');
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $s = $pdo->prepare('SELECT last FROM badge_counters WHERE day=?');
        $s->execute([$day]);
        $last = (int)$s->fetchColumn() + 1;
        $s = $pdo->prepare('INSERT INTO badge_counters(day,last) VALUES(?,?)
                            ON CONFLICT(day) DO UPDATE SET last=excluded.last');
        $s->execute([$day, $last]);
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }
    return $prefix . $day . '-' . str_pad((string)$last, 3, '0', STR_PAD_LEFT);
}

function createVisitor(array $d, array $me): array
{
    global $pdo, $allSettings;
    $name = trim((string)($d['full_name'] ?? ''));
    $purpose = trim((string)($d['purpose'] ?? ''));
    $host = trim((string)($d['host_name'] ?? ''));
    if ($name === '' || $purpose === '' || $host === '') {
        fail('Name, purpose and host are required', 422);
    }
    $badge = nextBadge($pdo);
    $qr = bin2hex(random_bytes(12));
    $s = $pdo->prepare("INSERT INTO visitors
        (badge_no,qr_token,full_name,company,phone,email,id_type,id_number,purpose,host_name,host_id,
         department,notes,status,check_in,expected_at,appointment_id,created_by)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'in',?,?,?,?)");
    $s->execute([
        $badge, $qr, $name,
        trim((string)($d['company'] ?? '')), trim((string)($d['phone'] ?? '')),
        trim((string)($d['email'] ?? '')), trim((string)($d['id_type'] ?? '')),
        trim((string)($d['id_number'] ?? '')), $purpose, $host,
        !empty($d['host_id']) ? (int)$d['host_id'] : null,
        trim((string)($d['department'] ?? '')), trim((string)($d['notes'] ?? '')),
        now(),
        !empty($d['expected_at']) ? (string)$d['expected_at'] : null,
        !empty($d['appointment_id']) ? (int)$d['appointment_id'] : null,
        $me['id'],
    ]);
    $id = (int)$pdo->lastInsertId();

    if (!empty($d['appointment_id'])) {
        $pdo->prepare("UPDATE appointments SET status='checked_in', visitor_id=? WHERE id=?")
            ->execute([$id, (int)$d['appointment_id']]);
    }
    $s = $pdo->prepare('SELECT * FROM visitors WHERE id=?');
    $s->execute([$id]);
    $v = $s->fetch();
    audit('checkin', 'visitor', (string)$id, $badge . ' — ' . $name);
    return $v;
}

/* ------------------------------------------------------------------ routing */

try {
    switch ($action) {

        case 'me':
            out([
                'user' => $me,
                'permissions' => [
                    'admin' => $me['role'] === 'admin',
                    'users' => $me['role'] === 'admin',
                    'appointments_manage' => can($me, 'appointments_manage'),
                ],
                'settings' => $allSettings,
            ]);

        case 'stats':
            $q = function (string $sql, array $p = []): int {
                global $pdo;
                $s = $pdo->prepare($sql); $s->execute($p);
                return (int)$s->fetchColumn();
            };
            $days = [];
            for ($i = 6; $i >= 0; $i--) {
                $d = date('Y-m-d', strtotime("-$i day"));
                $days[] = ['date' => $d, 'count' => $q('SELECT COUNT(*) FROM visitors WHERE substr(check_in,1,10)=?', [$d])];
            }
            $overstay = $q('SELECT COUNT(*) FROM visitors WHERE status=? AND (julianday(?) - julianday(check_in)) * 1440 > ?',
                ['in', now(), (int)setting('overstay_minutes', '480')]);
            out([
                'inside' => $q("SELECT COUNT(*) FROM visitors WHERE status='in'"),
                'today' => $q('SELECT COUNT(*) FROM visitors WHERE substr(check_in,1,10)=?', [date('Y-m-d')]),
                'checked_out_today' => $q('SELECT COUNT(*) FROM visitors WHERE substr(check_out,1,10)=?', [date('Y-m-d')]),
                'expected_today' => $q("SELECT COUNT(*) FROM appointments WHERE status='scheduled' AND substr(expected_at,1,10)=?", [date('Y-m-d')]),
                'overstay' => $overstay,
                'total' => $q('SELECT COUNT(*) FROM visitors'),
                'days' => $days,
            ]);

        case 'list':
            $params = [];
            $where = visitorFilter($_GET, $params);
            $countStmt = $pdo->prepare('SELECT COUNT(*) FROM visitors' . $where);
            $countStmt->execute($params);
            $total = (int)$countStmt->fetchColumn();
            $limit = max(1, min(200, (int)($_GET['limit'] ?? 25)));
            $pages = max(1, (int)ceil($total / $limit));
            $page  = max(1, min($pages, (int)($_GET['page'] ?? 1)));
            $s = $pdo->prepare('SELECT * FROM visitors' . $where . ' ORDER BY id DESC LIMIT ? OFFSET ?');
            foreach ($params as $i => $val) { $s->bindValue($i + 1, $val); }
            $s->bindValue(count($params) + 1, $limit, PDO::PARAM_INT);
            $s->bindValue(count($params) + 2, ($page - 1) * $limit, PDO::PARAM_INT);
            $s->execute();
            out([
                'visitors' => $s->fetchAll(), 'total' => $total,
                'page' => $page, 'pages' => $pages, 'limit' => $limit,
            ]);

        case 'lookup':
            $term = trim((string)($_GET['q'] ?? ''));
            if ($term === '') { out(['visitor' => null]); }
            $like = '%' . $term . '%';
            $s = $pdo->prepare('SELECT * FROM visitors WHERE badge_no=? OR qr_token=? OR phone=? OR id_number=?
                                OR full_name LIKE ? OR company LIKE ? ORDER BY id DESC LIMIT 1');
            $s->execute([$term, $term, $term, $term, $like, $like]);
            $v = $s->fetch();
            out(['visitor' => $v ?: null]);

        case 'create':
            need($me, 'checkin');
            out(['visitor' => createVisitor($in, $me)], 201);

        case 'checkout':
        case 'quick_checkout':
            need($me, 'checkout');
            $id = (int)($in['id'] ?? 0);
            if (!$id && !empty($in['q'])) {
                $s = $pdo->prepare('SELECT id FROM visitors WHERE badge_no=? OR qr_token=? ORDER BY id DESC LIMIT 1');
                $s->execute([$in['q'], $in['q']]);
                $id = (int)$s->fetchColumn();
            }
            $s = $pdo->prepare("UPDATE visitors SET status='out', check_out=? WHERE id=? AND status='in'");
            $s->execute([now(), $id]);
            if ($s->rowCount() === 0) { fail('Visitor not found or already checked out', 409); }
            $s = $pdo->prepare('SELECT * FROM visitors WHERE id=?'); $s->execute([$id]);
            $v = $s->fetch();
            audit('checkout', 'visitor', (string)$id, $v['badge_no'] . ' — ' . $v['full_name']);
            out(['ok' => true, 'visitor' => $v]);

        case 'update':
            need($me, 'edit');
            $id = (int)($in['id'] ?? 0);
            $name = trim(str_('full_name')); $purpose = trim(str_('purpose')); $host = trim(str_('host_name'));
            if ($id <= 0 || $name === '' || $purpose === '' || $host === '') {
                fail('ID, name, purpose and host are required', 422);
            }
            $s = $pdo->prepare("UPDATE visitors SET full_name=?,company=?,phone=?,email=?,id_type=?,id_number=?,
                purpose=?,host_name=?,host_id=?,department=?,notes=? WHERE id=?");
            $s->execute([
                $name, str_('company'), str_('phone'), str_('email'), str_('id_type'), str_('id_number'),
                $purpose, $host, !empty($in['host_id']) ? (int)$in['host_id'] : null,
                str_('department'), str_('notes'), $id,
            ]);
            if ($s->rowCount() === 0 && !$pdo->query('SELECT 1 FROM visitors WHERE id=' . $id)->fetchColumn()) {
                fail('Visitor not found', 404);
            }
            audit('update', 'visitor', (string)$id, $name);
            out(['ok' => true]);

        case 'delete':
            need($me, 'admin');
            $id = (int)($in['id'] ?? 0);
            $pdo->prepare('DELETE FROM visitors WHERE id=?')->execute([$id]);
            audit('delete', 'visitor', (string)$id);
            out(['ok' => true]);

        case 'password':
            if (strlen((string)($in['new_password'] ?? '')) < 6) { fail('Password must be at least 6 characters', 422); }
            $s = $pdo->prepare('SELECT password_hash FROM users WHERE id=?'); $s->execute([$me['id']]);
            if (!password_verify((string)($in['old_password'] ?? ''), (string)$s->fetchColumn())) {
                fail('Current password is wrong', 422);
            }
            $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')
                ->execute([password_hash((string)$in['new_password'], PASSWORD_DEFAULT), $me['id']]);
            audit('password_change', 'user', (string)$me['id']);
            out(['ok' => true]);

        case 'export':
            need($me, 'export');
            $params = [];
            $where = visitorFilter($_GET, $params);
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="visitors_' . date('Y-m-d') . '.csv"');
            $f = fopen('php://output', 'w');
            fputcsv($f, ['Badge', 'Name', 'Company', 'Phone', 'Email', 'ID Type', 'ID Number', 'Purpose',
                         'Host', 'Department', 'Status', 'Check In', 'Check Out']);
            $s = $pdo->prepare('SELECT * FROM visitors' . $where . ' ORDER BY id DESC');
            $s->execute($params);
            foreach ($s->fetchAll() as $r) {
                fputcsv($f, [$r['badge_no'], $r['full_name'], $r['company'], $r['phone'], $r['email'],
                    $r['id_type'], $r['id_number'], $r['purpose'], $r['host_name'], $r['department'],
                    $r['status'], $r['check_in'], $r['check_out']]);
            }
            audit('export', 'visitors', '', 'CSV export');
            fclose($f);
            exit;

        /* ---------------------------------------------------------- reports */

        case 'report':
            need($me, 'reports');
            $from = (string)($_GET['from'] ?? date('Y-m-01'));
            $to   = (string)($_GET['to'] ?? date('Y-m-d'));
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
                fail('Invalid date range', 422);
            }
            $p = [$from . ' 00:00:00', $to . ' 23:59:59'];
            $s = $pdo->prepare('SELECT COUNT(*) total,
                    SUM(status="in") inside_now,
                    SUM(status="out") checked_out,
                    ROUND(AVG(CASE WHEN check_out IS NOT NULL
                        THEN (julianday(check_out)-julianday(check_in))*1440 END),1) avg_minutes
                    FROM visitors WHERE check_in BETWEEN ? AND ?');
            $s->execute($p);
            $summary = $s->fetch();

            $s = $pdo->prepare('SELECT substr(check_in,1,10) date, COUNT(*) count
                                FROM visitors WHERE check_in BETWEEN ? AND ?
                                GROUP BY substr(check_in,1,10) ORDER BY date');
            $s->execute($p);
            $byDay = $s->fetchAll();

            $s = $pdo->prepare('SELECT host_name, COUNT(*) count,
                    ROUND(AVG(CASE WHEN check_out IS NOT NULL
                        THEN (julianday(check_out)-julianday(check_in))*1440 END),1) avg_minutes
                    FROM visitors WHERE check_in BETWEEN ? AND ?
                    GROUP BY host_name ORDER BY count DESC LIMIT 10');
            $s->execute($p);
            $byHost = $s->fetchAll();

            $s = $pdo->prepare('SELECT purpose, COUNT(*) count FROM visitors WHERE check_in BETWEEN ? AND ?
                                GROUP BY purpose ORDER BY count DESC');
            $s->execute($p);
            $byPurpose = $s->fetchAll();

            $s = $pdo->prepare('SELECT * FROM visitors WHERE check_in BETWEEN ? AND ? ORDER BY id DESC LIMIT 200');
            $s->execute($p);
            $rows = $s->fetchAll();
            out([
                'from' => $from, 'to' => $to,
                'summary' => [
                    'total' => (int)($summary['total'] ?? 0),
                    'inside' => (int)($summary['inside_now'] ?? 0),
                    'checked_out' => (int)($summary['checked_out'] ?? 0),
                    'avg_minutes' => (float)($summary['avg_minutes'] ?? 0),
                ],
                'by_day' => $byDay, 'by_host' => $byHost,
                'by_purpose' => $byPurpose, 'rows' => $rows,
            ]);

        /* -------------------------------------------------------- host directory */

        case 'hosts.list':
            $s = $pdo->query('SELECT h.*, (SELECT COUNT(*) FROM visitors v WHERE v.host_id=h.id) visits
                              FROM hosts h ORDER BY h.active DESC, h.name');
            out(['hosts' => $s->fetchAll()]);

        case 'hosts.save':
            need($me, 'appointments_manage');
            $id = (int)($in['id'] ?? 0);
            $name = str_('name');
            if ($name === '') { fail('Host name is required', 422); }
            $data = [$name, str_('department'), str_('phone'), str_('email'), !empty($in['active']) ? 1 : 0];
            if ($id > 0) {
                $s = $pdo->prepare('UPDATE hosts SET name=?,department=?,phone=?,email=?,active=? WHERE id=?');
                $s->execute([...$data, $id]);
            } else {
                $s = $pdo->prepare('INSERT INTO hosts(name,department,phone,email,active,created_at) VALUES(?,?,?,?,?,?)');
                $s->execute([...$data, now()]);
                $id = (int)$pdo->lastInsertId();
            }
            audit('host_save', 'host', (string)$id, $name);
            out(['ok' => true, 'id' => $id]);

        case 'hosts.delete':
            need($me, 'admin');
            $id = (int)($in['id'] ?? 0);
            $pdo->prepare('UPDATE visitors SET host_id=NULL WHERE host_id=?')->execute([$id]);
            $pdo->prepare('UPDATE appointments SET host_id=NULL WHERE host_id=?')->execute([$id]);
            $pdo->prepare('DELETE FROM hosts WHERE id=?')->execute([$id]);
            audit('host_delete', 'host', (string)$id);
            out(['ok' => true]);

        /* ---------------------------------------------------------- appointments */

        case 'appointments.list':
            $s = $pdo->query("SELECT a.*, h.name host_from_directory
                              FROM appointments a LEFT JOIN hosts h ON h.id=a.host_id
                              ORDER BY a.expected_at DESC LIMIT 500");
            out(['appointments' => $s->fetchAll()]);

        case 'appointments.create':
            need($me, 'appointments_manage');
            $name = str_('full_name'); $purpose = str_('purpose'); $host = str_('host_name');
            $when = str_('expected_at');
            if ($name === '' || $purpose === '' || $host === '' || $when === '') {
                fail('Name, purpose, host and expected date/time are required', 422);
            }
            $s = $pdo->prepare("INSERT INTO appointments
                (full_name,company,phone,email,purpose,host_id,host_name,department,expected_at,notes,created_by,created_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
            $s->execute([
                $name, str_('company'), str_('phone'), str_('email'), $purpose,
                !empty($in['host_id']) ? (int)$in['host_id'] : null, $host, str_('department'),
                $when, str_('notes'), $me['id'], now(),
            ]);
            $id = (int)$pdo->lastInsertId();
            audit('appointment_create', 'appointment', (string)$id, $name);
            out(['ok' => true, 'id' => $id], 201);

        case 'appointments.update':
            need($me, 'appointments_manage');
            $id = (int)($in['id'] ?? 0);
            if ($id <= 0 || str_('full_name') === '' || str_('purpose') === '' || str_('host_name') === '') {
                fail('ID, name, purpose and host are required', 422);
            }
            $s = $pdo->prepare("UPDATE appointments SET full_name=?,company=?,phone=?,email=?,purpose=?,
                host_id=?,host_name=?,department=?,expected_at=?,notes=? WHERE id=? AND status='scheduled'");
            $s->execute([
                str_('full_name'), str_('company'), str_('phone'), str_('email'), str_('purpose'),
                !empty($in['host_id']) ? (int)$in['host_id'] : null, str_('host_name'), str_('department'),
                str_('expected_at'), str_('notes'), $id,
            ]);
            audit('appointment_update', 'appointment', (string)$id);
            out(['ok' => true]);

        case 'appointments.cancel':
            need($me, 'appointments_manage');
            $id = (int)($in['id'] ?? 0);
            $pdo->prepare("UPDATE appointments SET status='cancelled' WHERE id=? AND status='scheduled'")->execute([$id]);
            audit('appointment_cancel', 'appointment', (string)$id);
            out(['ok' => true]);

        case 'appointments.checkin':
            need($me, 'appointments_checkin');
            $id = (int)($in['id'] ?? 0);
            $s = $pdo->prepare("SELECT * FROM appointments WHERE id=? AND status='scheduled'");
            $s->execute([$id]);
            $a = $s->fetch();
            if (!$a) { fail('Appointment not found or already processed', 404); }
            $v = createVisitor([
                'full_name' => $a['full_name'], 'company' => $a['company'], 'phone' => $a['phone'],
                'email' => $a['email'], 'purpose' => $a['purpose'], 'host_name' => $a['host_name'],
                'host_id' => $a['host_id'], 'department' => $a['department'], 'notes' => $a['notes'],
                'expected_at' => $a['expected_at'], 'appointment_id' => $a['id'],
            ], $me);
            out(['visitor' => $v], 201);

        /* ------------------------------------------------------- user management */

        case 'users.list':
            need($me, 'users');
            out(['users' => $pdo->query('SELECT id,username,full_name,role,active,created_at FROM users ORDER BY id')->fetchAll()]);

        case 'users.save':
            need($me, 'users');
            $id = (int)($in['id'] ?? 0);
            $username = strtolower(str_('username'));
            $full = str_('full_name');
            $role = str_('role');
            if (!in_array($role, ['admin', 'guard', 'reception'], true)) { fail('Invalid role', 422); }
            if ($id > 0 && $username === '') { fail('Username is required', 422); }
            if ($id <= 0 && ($username === '' || $full === '' || strlen((string)($in['password'] ?? '')) < 6)) {
                fail('Username, full name and password (min 6 chars) are required', 422);
            }
            if ($username !== '') {
                $s = $pdo->prepare('SELECT id FROM users WHERE username=? AND id<>?');
                $s->execute([$username, $id]);
                if ($s->fetchColumn()) { fail('Username already taken', 409); }
            }
            $active = isset($in['active']) ? (int)(bool)$in['active'] : 1;
            if ($id > 0) {
                if ($id === $me['id'] && ($role !== 'admin' || !$active)) { fail('You cannot demote or disable yourself', 422); }
                $sql = 'UPDATE users SET username=?,full_name=?,role=?,active=?';
                $params = [$username, $full, $role, $active];
                if (!empty($in['password'])) {
                    if (strlen((string)$in['password']) < 6) { fail('Password must be at least 6 characters', 422); }
                    $sql .= ',password_hash=?';
                    $params[] = password_hash((string)$in['password'], PASSWORD_DEFAULT);
                }
                $sql .= ' WHERE id=?';
                $params[] = $id;
                $pdo->prepare($sql)->execute($params);
            } else {
                $pdo->prepare('INSERT INTO users(username,password_hash,full_name,role,active,created_at) VALUES(?,?,?,?,?,?)')
                    ->execute([$username, password_hash((string)$in['password'], PASSWORD_DEFAULT), $full, $role, $active, now()]);
                $id = (int)$pdo->lastInsertId();
            }
            audit('user_save', 'user', (string)$id, $username);
            out(['ok' => true, 'id' => $id]);

        case 'users.delete':
            need($me, 'users');
            $id = (int)($in['id'] ?? 0);
            if ($id === $me['id']) { fail('You cannot delete your own account', 422); }
            $s = $pdo->prepare('SELECT role FROM users WHERE id=?'); $s->execute([$id]);
            if ($s->fetchColumn() === 'admin' && (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='admin' AND active=1")->fetchColumn() <= 1) {
                fail('At least one active admin is required', 422);
            }
            $pdo->prepare('DELETE FROM users WHERE id=?')->execute([$id]);
            audit('user_delete', 'user', (string)$id);
            out(['ok' => true]);

        /* ---------------------------------------------------------- audit + settings */

        case 'audit.list':
            need($me, 'users');
            $where = []; $p = [];
            if (!empty($_GET['q'])) { $where[] = '(action LIKE ? OR username LIKE ? OR detail LIKE ?)'; $like = '%' . $_GET['q'] . '%'; array_push($p, $like, $like, $like); }
            if (!empty($_GET['from'])) { $where[] = 'substr(at,1,10) >= ?'; $p[] = $_GET['from']; }
            if (!empty($_GET['to'])) { $where[] = 'substr(at,1,10) <= ?'; $p[] = $_GET['to']; }
            $sql = 'SELECT * FROM audit_log' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY id DESC LIMIT 300';
            $s = $pdo->prepare($sql); $s->execute($p);
            out(['entries' => $s->fetchAll()]);

        case 'settings.get':
            need($me, 'users');
            out(['settings' => $allSettings]);

        case 'settings.save':
            need($me, 'users');
            $allowed = ['company_name', 'badge_prefix', 'overstay_minutes', 'session_timeout', 'badge_footer'];
            $s = $pdo->prepare('INSERT INTO settings(key,value) VALUES(?,?)
                                ON CONFLICT(key) DO UPDATE SET value=excluded.value');
            foreach ($allowed as $key) {
                if (!array_key_exists($key, $in)) { continue; }
                $val = trim((string)$in[$key]);
                if ($key === 'overstay_minutes') { $val = (string)max(1, min(10080, (int)$val)); }
                if ($key === 'session_timeout') { $val = (string)max(5, min(480, (int)$val)); }
                if ($key === 'badge_prefix') { $val = strtoupper(preg_replace('/[^a-z0-9]/i', '', $val) ?: 'V'); }
                if ($key === 'company_name' && $val === '') { $val = 'VisitorPass'; }
                $s->execute([$key, $val]);
            }
            audit('settings_save', 'settings');
            out(['ok' => true]);

        /* ------------------------------------------------------- backup / restore */

        case 'backup':
            need($me, 'users');
            $tmp = sys_get_temp_dir() . '/vms_backup_' . date('Ymd_His') . '.sqlite';
            // Use a fresh connection: VACUUM refuses to run while other statements are active.
            $bp = new PDO('sqlite:' . $dbFile, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            $bp->exec('VACUUM INTO ' . $bp->quote($tmp));
            $bp = null;
            register_shutdown_function(function () use ($tmp) { @unlink($tmp); });
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="vms_backup_' . date('Y-m-d_His') . '.sqlite"');
            header('Content-Length: ' . filesize($tmp));
            readfile($tmp);
            audit('backup', 'database');
            exit;

        case 'restore':
            need($me, 'users');
            if (!isset($_FILES['db']) || $_FILES['db']['error'] !== UPLOAD_ERR_OK || $_FILES['db']['size'] > 52428800) {
                fail('No valid database file uploaded (max 50 MB)', 422);
            }
            $upload = $dir . '/restore_' . date('Ymd_His') . '.sqlite';
            if (!move_uploaded_file($_FILES['db']['tmp_name'], $upload)) { fail('Could not store uploaded file', 500); }
            // Import the backup's data instead of replacing the file — reliable on Windows
            // where an open SQLite database cannot be renamed or unlinked.
            // Use the existing connection only: a second PDO handle would lock the file.
            gc_collect_cycles();
            $pdo->exec('ATTACH DATABASE ' . $pdo->quote($upload) . ' AS restore_src');
            try {
                $names = array_column(
                    $pdo->query('SELECT name FROM restore_src.sqlite_master WHERE type="table"')->fetchAll(),
                    'name'
                );
                if (!in_array('users', $names, true) || !in_array('visitors', $names, true)) {
                    throw new RuntimeException('Uploaded file is not a VisitorPass database');
                }
            } catch (Throwable $e) {
                $pdo->exec('DETACH DATABASE restore_src');
                @unlink($upload);
                fail('Invalid backup: ' . $e->getMessage(), 422);
            }
            $schema = [
                'audit_log'      => ['id', 'at', 'user_id', 'username', 'action', 'entity', 'entity_id', 'detail'],
                'appointments'   => ['id', 'full_name', 'company', 'phone', 'email', 'purpose', 'host_id', 'host_name',
                                     'department', 'expected_at', 'notes', 'status', 'visitor_id', 'created_by', 'created_at'],
                'visitors'       => ['id', 'badge_no', 'full_name', 'company', 'phone', 'email', 'id_type', 'id_number',
                                     'purpose', 'host_name', 'department', 'notes', 'status', 'check_in', 'check_out',
                                     'created_by', 'host_id', 'qr_token', 'expected_at', 'appointment_id'],
                'badge_counters' => ['day', 'last'],
                'login_attempts' => ['username', 'ip', 'attempts', 'locked_until'],
                'hosts'          => ['id', 'name', 'department', 'phone', 'email', 'active', 'created_at'],
                'settings'       => ['key', 'value'],
                'users'          => ['id', 'username', 'password_hash', 'full_name', 'role', 'active', 'created_at'],
            ];
            $pdo->exec('BEGIN IMMEDIATE');
            try {
                foreach (array_keys($schema) as $t) { $pdo->exec('DELETE FROM ' . $t); }
                foreach ($schema as $t => $cols) {
                    $src = [];
                    foreach ($pdo->query('PRAGMA restore_src.table_info(' . $t . ')') as $r) { $src[] = $r['name']; }
                    $use = array_values(array_intersect($cols, $src));
                    if (!$use) { continue; }
                    $list = implode(',', $use);
                    $pdo->exec('INSERT INTO ' . $t . ' (' . $list . ') SELECT ' . $list . ' FROM restore_src.' . $t);
                }
                $pdo->exec('COMMIT');
            } catch (Throwable $e) {
                $pdo->exec('ROLLBACK');
                $pdo->exec('DETACH DATABASE restore_src');
                @unlink($upload);
                fail('Restore failed: ' . $e->getMessage(), 500);
            }
            $pdo->exec('DETACH DATABASE restore_src');
            @unlink($upload);
            audit('restore', 'database', '', 'Database restored from backup');
            out(['ok' => true]);

        default:
            fail('Unknown action', 404);
    }
} catch (Throwable $e) {
    fail('Server error: ' . $e->getMessage(), 500);
}
