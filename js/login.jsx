/* VisitorPass - login screen */

/* ============================== login ============================== */
function Login({ onLogin, company }) {
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { onLogin((await api('login', f)).user); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <div className="logo"><span><Icon name="users" size={20} /></span> {company || 'VisitorPass'}</div>
        <p>Visitor Management System</p>
        {err && <div className="err-msg">{err}</div>}
        <div className="field">
          <label>Username</label>
          <input autoFocus autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <div className="hint">Default: admin / admin123 &nbsp;•&nbsp; guard / guard123 &nbsp;•&nbsp; reception / reception123</div>
      </form>
    </div>
  );
}

Object.assign(window, { Login });
