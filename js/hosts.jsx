/* VisitorPass - host directory screen */

/* ============================== hosts ============================== */
function Hosts({ notify, canManage }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const load = useCallback(async () => {
    try { setRows((await api('hosts.list')).hosts); } catch (e) { notify(e.message, 'err'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try { await api('hosts.save', form); notify('Host saved'); setForm(null); load(); }
    catch (x) { notify(x.message, 'err'); }
  };
  const del = async (h) => {
    if (!confirm(`Remove host ${h.name}?`)) return;
    try { await api('hosts.delete', { id: h.id }); notify('Host removed'); load(); }
    catch (e) { notify(e.message, 'err'); }
  };
  const visible = rows.filter((h) => h.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <div className="page-head">
        <div><h1>Host Directory</h1><p className="sub">People that visitors come to see</p></div>
        {canManage && <button className="btn" onClick={() => setForm({ name: '', department: '', phone: '', email: '', active: 1 })}><Icon name="user-plus" /> Add host</button>}
      </div>
      <div className="card">
        <div className="toolbar"><input className="grow" placeholder="Search hosts…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {visible.length === 0 ? <Empty>No hosts found.</Empty> : (
          <div className="tbl"><table>
            <thead><tr><th>Name</th><th>Department</th><th>Contact</th><th>Visits</th><th>Status</th><th></th></tr></thead>
            <tbody>{visible.map((h) => (
              <tr key={h.id}>
                <td><b>{h.name}</b></td><td>{h.department || '—'}</td>
                <td>{h.phone || '—'}<div className="sub">{h.email || ''}</div></td>
                <td>{h.visits}</td>
                <td><span className={'pill ' + (h.active ? 'in' : 'muted')}>{h.active ? 'Active' : 'Inactive'}</span></td>
                <td>{canManage && <div className="actions">
                  <button className="btn sec sm" onClick={() => setForm(h)}>Edit</button>
                  <button className="btn danger sm" onClick={() => del(h)}>Delete</button>
                </div>}</td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </div>
      {form && (
        <Modal title={form.id ? 'Edit host' : 'Add host'} onClose={() => setForm(null)} small>
          <form onSubmit={save}>
            <div className="form one">
              <div><label>Name *</label><input required value={form.name} onChange={set('name')} /></div>
              <div><label>Department</label><input value={form.department} onChange={set('department')} /></div>
              <div><label>Phone</label><input value={form.phone} onChange={set('phone')} /></div>
              <div><label>Email</label><input type="email" value={form.email} onChange={set('email')} /></div>
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

Object.assign(window, { Hosts });
