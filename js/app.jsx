/* ==========================================================================
   VisitorPass — application shell
   Screens live in their own files and are loaded before this one.
   ========================================================================== */
function App() {
  const [user, setUser] = useState(undefined);
  const [settings, setSettings] = useState({});
  const [page, setPage] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [badge, setBadge] = useState(null);
  const [hosts, setHosts] = useState([]);
  const [prefill, setPrefill] = useState(null);

  const notify = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const refreshHosts = useCallback(async () => {
    try { setHosts((await api('hosts.list')).hosts); } catch (e) { /* non-fatal */ }
  }, []);

  useEffect(() => {
    window.onAuthLost = () => { setUser(null); setSettings({}); };
    api('me').then((d) => { setUser(d.user); setSettings(d.settings || {}); refreshHosts(); })
             .catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await api('logout', {}).catch(() => {});
    setUser(null); setPage('dashboard'); setSettings({});
  };
  const go = (p) => { setPage(p); window.scrollTo(0, 0); };
  const checkInFromAppointment = (v) => { showBadge(v); go('dashboard'); };

  if (user === undefined) return <Loading />;
  if (!user) return <Login onLogin={setUser} company={settings.company_name} />;

  const admin = user.role === 'admin';
  const canAppt = admin || user.role === 'reception';
  const nav = [
    ['dashboard', 'grid', 'Dashboard'],
    ['checkin', 'plus-circle', 'Check-in'],
    ['visitors', 'clipboard', 'Visitors'],
    ['appointments', 'calendar', 'Appointments'],
    ['hosts', 'user', 'Hosts'],
    ['kiosk', 'monitor', 'Kiosk'],
    ['reports', 'chart', 'Reports'],
    ...(admin ? [['users', 'lock', 'Users'], ['audit', 'file', 'Audit Log']] : []),
    ['settings', 'settings', 'Settings'],
  ];

  return (
    <>
      <div className="app">
        <aside className="sidebar">
          <div className="logo"><span><Icon name="users" size={20} /></span> {settings.company_name || 'VisitorPass'}</div>
          {nav.map(([id, ic, label]) => (
            <button key={id} className={'nav ' + (page === id ? 'active' : '')} onClick={() => go(id)}><Icon name={ic} /> {label}</button>
          ))}
          <div className="spacer" />
          <div className="who"><b>{user.full_name}</b>{user.role}</div>
          <button className="nav" onClick={logout}><Icon name="logout" /> Sign out</button>
        </aside>
        <main className="main">
          {page === 'dashboard' && <Dashboard notify={notify} showBadge={setBadge} go={go} settings={settings} />}
          {page === 'checkin' && <CheckIn notify={notify} showBadge={setBadge} hosts={hosts} prefill={prefill} clearPrefill={() => setPrefill(null)} />}
          {page === 'visitors' && <Visitors user={user} notify={notify} showBadge={setBadge} hosts={hosts} settings={settings} />}
          {page === 'appointments' && <Appointments notify={notify} hosts={hosts} showBadge={setBadge} checkIn={checkInFromAppointment} />}
          {page === 'hosts' && <Hosts notify={notify} canManage={admin || canAppt} />}
          {page === 'kiosk' && <Kiosk notify={notify} showBadge={setBadge} go={go} />}
          {page === 'reports' && <Reports notify={notify} settings={settings} />}
          {page === 'users' && admin && <Users notify={notify} me={user} />}
          {page === 'audit' && admin && <Audit notify={notify} />}
          {page === 'settings' && <Settings notify={notify} settings={settings} isAdmin={admin}
            onSettings={(d) => setSettings(d.settings || {})} />}
        </main>
      </div>
      {badge && <BadgeModal v={badge} company={settings.company_name} footer={settings.badge_footer} onClose={() => setBadge(null)} />}
      {toast && <div className={'toast ' + (toast.type === 'err' ? 'err' : '')}>{toast.msg}</div>}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
