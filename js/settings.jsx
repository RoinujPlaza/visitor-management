/* VisitorPass - settings and backup screen */

/* ============================== settings ============================== */
function Settings({ notify, settings, isAdmin, onSettings }) {
  const [pw, setPw] = useState({ old_password: '', new_password: '' });
  const [sys, setSys] = useState(settings);
  const [busy, setBusy] = useState(false);
  const file = useRef(null);
  useEffect(() => { setSys(settings); }, [settings]);

  const changePw = async (e) => {
    e.preventDefault();
    try { await api('password', pw); notify('Password changed'); setPw({ old_password: '', new_password: '' }); }
    catch (x) { notify(x.message, 'err'); }
  };
  const saveSys = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api('settings.save', sys); notify('Settings saved'); onSettings(await api('me')); }
    catch (x) { notify(x.message, 'err'); }
    setBusy(false);
  };
  const restore = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!confirm('Restore this backup? Your current database will be replaced (a .old copy is kept).')) return;
    const fd = new FormData();
    fd.append('db', f);
    setBusy(true);
    try { await api('restore', fd, '', { multipart: true }); notify('Database restored — reloading…'); setTimeout(() => location.reload(), 1200); }
    catch (x) { notify(x.message, 'err'); }
    setBusy(false);
    e.target.value = '';
  };
  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><p className="sub">Account and system preferences</p></div></div>
      <div className="grid two">
        <form className="card" onSubmit={changePw}>
          <h3 style={{ marginBottom: 14 }}>Change password</h3>
          <div style={{ marginBottom: 14 }}><label>Current password</label>
            <input type="password" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} /></div>
          <div style={{ marginBottom: 14 }}><label>New password (min. 6 chars)</label>
            <input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></div>
          <button className="btn">Update password</button>
        </form>
        {isAdmin && <>
          <form className="card" onSubmit={saveSys}>
            <h3 style={{ marginBottom: 14 }}>System settings</h3>
            <div className="form one">
              <div><label>Company / display name</label><input value={sys.company_name || ''} onChange={(e) => setSys({ ...sys, company_name: e.target.value })} /></div>
              <div><label>Badge prefix</label><input value={sys.badge_prefix || ''} onChange={(e) => setSys({ ...sys, badge_prefix: e.target.value })} /></div>
              <div><label>Overstay threshold (minutes)</label><input type="number" value={sys.overstay_minutes || ''} onChange={(e) => setSys({ ...sys, overstay_minutes: e.target.value })} /></div>
              <div><label>Session timeout (minutes)</label><input type="number" value={sys.session_timeout || ''} onChange={(e) => setSys({ ...sys, session_timeout: e.target.value })} /></div>
              <div><label>Badge footer text</label><input value={sys.badge_footer || ''} onChange={(e) => setSys({ ...sys, badge_footer: e.target.value })} /></div>
            </div>
            <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="btn" disabled={busy}>Save settings</button>
            </div>
          </form>
          <div className="card span2">
            <h3 style={{ marginBottom: 8 }}>Database backup & restore</h3>
            <p className="sub">Download a full snapshot of the SQLite database, or restore from a previous backup (.sqlite / .db).</p>
            <div className="row-gap" style={{ marginTop: 14 }}>
              <a className="btn" href="api/index.php?action=backup"><Icon name="download" /> Download backup</a>
              <input ref={file} type="file" accept=".sqlite,.db,application/x-sqlite3" onChange={restore} style={{ maxWidth: 300 }} />
              {busy && <span className="sub">Working…</span>}
            </div>
          </div>
        </>}
      </div>
    </>
  );
}

Object.assign(window, { Settings });
