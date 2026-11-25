/* VisitorPass - appointments screen */

/* ============================== appointments ============================== */
const EMPTY_APPT = {
  full_name: '', company: '', phone: '', email: '', purpose: '', host_name: '', host_id: '',
  department: '', expected_at: todayStr() + 'T09:00', notes: '',
};

function Appointments({ notify, hosts, showBadge, checkIn }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await api('appointments.list')).appointments); }
    catch (e) { notify(e.message, 'err'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try {
      const raw = String(form.expected_at || '');
      let dt = raw.includes('T') ? raw : raw.replace(' ', 'T');
      if (dt.length === 16) dt += ':00';
      const payload = { ...form, expected_at: dt.slice(0, 19).replace('T', ' ') };
      if (form.id) await api('appointments.update', payload);
      else await api('appointments.create', payload);
      notify(form.id ? 'Appointment updated' : 'Appointment scheduled');
      setForm(null); load();
    } catch (x) { notify(x.message, 'err'); }
  };
  const act = async (a, id, extra = {}) => {
    try {
      const r = await api('appointments.' + a, { id, ...extra });
      notify(a === 'checkin' ? `Checked in: ${r.visitor.badge_no}` : 'Appointment cancelled');
      if (a === 'checkin') { checkIn(r.visitor); }
      load();
    } catch (e) { notify(e.message, 'err'); }
  };
  const visible = rows.filter((a) => !filter || a.status === filter);

  return (
    <>
      <div className="page-head">
        <div><h1>Appointments</h1><p className="sub">Expected visitors and pre-registrations</p></div>
        <div className="row-gap">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 160 }}>
            <option value="">All status</option><option value="scheduled">Scheduled</option>
            <option value="checked_in">Checked in</option><option value="cancelled">Cancelled</option>
          </select>
          <button className="btn" onClick={() => setForm({ ...EMPTY_APPT })}><Icon name="plus-circle" /> New appointment</button>
        </div>
      </div>
      <div className="card">
        {loading ? <Loading /> : visible.length === 0 ? <Empty>No appointments found.</Empty> : (
          <div className="tbl"><table>
            <thead><tr><th>Visitor</th><th>Expected</th><th>Host / Purpose</th><th>Contact</th><th>Status</th><th></th></tr></thead>
            <tbody>{visible.map((a) => (
              <tr key={a.id}>
                <td><b>{a.full_name}</b><div className="sub">{a.company || '—'}</div></td>
                <td>{fmt(a.expected_at)}</td>
                <td>{a.host_name}<div className="sub">{a.purpose}</div></td>
                <td>{a.phone || '—'}<div className="sub">{a.email || ''}</div></td>
                <td><span className={'pill ' + (a.status === 'scheduled' ? 'in' : a.status === 'checked_in' ? 'out' : 'muted')}>{a.status.replace('_', ' ')}</span></td>
                <td><div className="actions">
                  {a.status === 'scheduled' && <>
                    <button className="btn ok sm" onClick={() => act('checkin', a.id)}>Check in</button>
                    <button className="btn sec sm" onClick={() => setForm(a)}>Edit</button>
                    <button className="btn sec sm" onClick={() => act('cancel', a.id)}>Cancel</button>
                  </>}
                  {a.visitor_id && <button className="btn sec sm" onClick={() => showBadge({ badge_no: '—', full_name: a.full_name, host_name: a.host_name, purpose: a.purpose, check_in: a.expected_at })}>Details</button>}
                </div></td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </div>
      {form && (
        <Modal title={form.id ? 'Edit appointment' : 'New appointment'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="form">
              <div className="full"><label>Full name *</label><input required value={form.full_name} onChange={set('full_name')} /></div>
              <div><label>Company</label><input value={form.company} onChange={set('company')} /></div>
              <div><label>Phone</label><input value={form.phone} onChange={set('phone')} /></div>
              <div><label>Email</label><input type="email" value={form.email} onChange={set('email')} /></div>
              <div><label>Purpose *</label>
                <select required value={form.purpose} onChange={set('purpose')}><option value="">— Select —</option>{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select>
              </div>
              <div><label>Expected date & time *</label><input required type="datetime-local" value={String(form.expected_at).replace(' ', 'T').slice(0, 16)} onChange={set('expected_at')} /></div>
              <div><label>Host *</label><input required list="appt-hosts" value={form.host_name} onChange={(e) => {
                const h = hosts.find((x) => x.name.toLowerCase() === e.target.value.toLowerCase());
                setForm({ ...form, host_name: e.target.value, host_id: h ? h.id : '', department: h ? h.department || '' : form.department });
              }} /><datalist id="appt-hosts">{hosts.filter((h) => h.active).map((h) => <option key={h.id} value={h.name} />)}</datalist></div>
              <div><label>Department</label><input value={form.department} onChange={set('department')} /></div>
              <div className="full"><label>Notes</label><textarea rows="2" value={form.notes} onChange={set('notes')} /></div>
            </div>
            <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="btn">{form.id ? 'Save changes' : 'Schedule appointment'}</button>
              <button type="button" className="btn sec" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

Object.assign(window, { EMPTY_APPT, Appointments });
