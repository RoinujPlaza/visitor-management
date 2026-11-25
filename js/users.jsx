/* VisitorPass - user management screen */

/* ============================== users ============================== */
function Users({ notify, me }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const load = useCallback(async () => {
    try { setRows((await api('users.list')).users); } catch (e) { notify(e.message, 'err'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try { await api('users.save', form); notify('User saved'); setForm(null); load(); }
    catch (x) { notify(x.message, 'err'); }
  };
  const del = async (u) => {
    if (!confirm(`Delete user ${u.username}?`)) return;
    try { await api('users.delete', { id: u.id }); notify('User deleted'); load(); }
    catch (e) { notify(e.message, 'err'); }
  };
  return (
    <>
      <div className="page-head">
        <div><h1>Users & Access</h1><p className="sub">Manage accounts and roles</p></div>
        <button className="btn" onClick={() => setForm({ username: '', full_name: '', password: '', role: 'guard', active: 1 })}><Icon name="user-plus" /> Add user</button>
      </div>
      <div className="card">
        <div className="tbl"><table>
          <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>{rows.map((u) => <tr key={u.id}>
            <td><b>{u.username}</b>{u.id === me.id && <span className="you">you</span>}</td>
            <td>{u.full_name}</td><td><span className="pill role">{u.role}</span></td>
            <td><span className={'pill ' + (u.active ? 'in' : 'muted')}>{u.active ? 'Active' : 'Disabled'}</span></td>
            <td>{fmtDate(u.created_at)}</td>
            <td><div className="actions">
              <button className="btn sec sm" onClick={() => setForm({ ...u, password: '' })}>Edit</button>
              {u.id !== me.id && <button className="btn danger sm" onClick={() => del(u)}>Delete</button>}
            </div></td>
          </tr>)}</tbody>
        </table></div>
      </div>
      {form && (
        <Modal title={form.id ? 'Edit user' : 'Add user'} onClose={() => setForm(null)} small>
          <form onSubmit={save}>
            <div className="form one">
              <div><label>Username *</label><input required value={form.username} onChange={set('username')} /></div>
              <div><label>Full name *</label><input required value={form.full_name} onChange={set('full_name')} /></div>
              <div><label>{form.id ? 'New password (leave blank to keep)' : 'Password *'}</label>
                <input type="password" value={form.password} onChange={set('password')} /></div>
              <div><label>Role</label><select value={form.role} onChange={set('role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
              <label className="check"><input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })} /> Active</label>
            </div>
            <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="btn">Save</button><button type="button" className="btn sec" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

Object.assign(window, { Users });
