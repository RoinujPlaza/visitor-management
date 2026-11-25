/* VisitorPass - audit log screen */

/* ============================== audit log ============================== */
function Audit({ notify }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const load = useCallback(async () => {
    try { setRows((await api('audit.list', null, esc({ q, from, to }))).entries); }
    catch (e) { notify(e.message, 'err'); }
  }, [q, from, to]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  return (
    <>
      <div className="page-head"><div><h1>Audit Log</h1><p className="sub">Record of all significant actions</p></div></div>
      <div className="card">
        <div className="toolbar">
          <input className="grow" placeholder="Search action, user, detail…" value={q} onChange={(e) => setQ(e.target.value)} />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {rows.length === 0 ? <Empty>No log entries.</Empty> : (
          <div className="tbl"><table>
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}>
              <td>{fmt(r.at)}</td><td>{r.username || '—'}</td>
              <td><code>{r.action}</code></td><td>{r.entity || '—'} {r.entity_id ? <span className="sub">#{r.entity_id}</span> : null}</td>
              <td>{r.detail || '—'}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

Object.assign(window, { Audit });
