/* VisitorPass - visitor list screen */

/* ============================== visitors ============================== */
function Visitors({ user, notify, showBadge, hosts, settings }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [hostId, setHostId] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState(null);
  const [loading, setLoading] = useState(true);

  const query = esc({ q, status, from, to, host_id: hostId, page, limit: meta.limit });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api('list', null, query);
      setRows(d.visitors); setMeta({ page: d.page, pages: d.pages, total: d.total, limit: d.limit });
    } catch (e) { notify(e.message, 'err'); }
    setLoading(false);
  }, [query]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  const resetPage = (fn) => (e) => { fn(e.target.value); setPage(1); };

  const out = async (v) => {
    try { await api('checkout', { id: v.id }); notify(`${v.full_name} checked out`); load(); }
    catch (e) { notify(e.message, 'err'); }
  };
  const del = async (v) => {
    if (!confirm(`Delete record for ${v.full_name}? This cannot be undone.`)) return;
    try { await api('delete', { id: v.id }); notify('Record deleted'); load(); }
    catch (e) { notify(e.message, 'err'); }
  };
  const save = async (f) => {
    try { await api('update', f); notify('Visitor updated'); setEdit(null); load(); }
    catch (e) { notify(e.message, 'err'); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Visitors</h1><p className="sub">{meta.total} record{meta.total === 1 ? '' : 's'} found</p></div>
        <a className="btn sec" href={'api/index.php?action=export&' + esc({ q, status, from, to, host_id: hostId })}><Icon name="download" /> Export CSV</a>
      </div>
      <div className="card">
        <div className="toolbar">
          <input className="grow" placeholder="Search name, company, host, badge, phone…" value={q} onChange={resetPage(setQ)} />
          <select value={status} onChange={resetPage(setStatus)}>
            <option value="">All status</option><option value="in">Inside</option><option value="out">Checked out</option>
          </select>
          <select value={hostId} onChange={resetPage(setHostId)}>
            <option value="">All hosts</option>
            {hosts.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <input type="date" value={from} onChange={resetPage(setFrom)} title="From" />
          <input type="date" value={to} onChange={resetPage(setTo)} title="To" />
          {(q || status || from || to || hostId) && <button className="btn sec sm" onClick={() => { setQ(''); setStatus(''); setFrom(''); setTo(''); setHostId(''); setPage(1); }}>Clear</button>}
        </div>
        {loading ? <Loading /> : rows.length === 0 ? <Empty>No visitors found.</Empty> : (
          <div className="tbl"><table>
            <thead><tr><th>Badge</th><th>Visitor</th><th>Host / Purpose</th><th>Check in</th><th>Check out</th><th>Status</th><th></th></tr></thead>
            <tbody>{rows.map((v) => (
              <tr key={v.id}>
                <td><code>{v.badge_no}</code></td>
                <td><b>{v.full_name}</b><div className="sub">{[v.company, v.phone].filter(Boolean).join(' • ')}</div></td>
                <td>{v.host_name}<div className="sub">{v.purpose}{v.department ? ' • ' + v.department : ''}</div></td>
                <td>{fmt(v.check_in)}</td>
                <td>{fmt(v.check_out)}<div className="sub">{duration(v.check_in, v.check_out)}</div></td>
                <td><span className={'pill ' + v.status}>{v.status === 'in' ? 'Inside' : 'Out'}</span></td>
                <td><div className="actions">
                  {v.status === 'in' && <button className="btn ok sm" onClick={() => out(v)}>Check out</button>}
                  <button className="btn sec sm" onClick={() => showBadge(v)}>Badge</button>
                  <button className="btn sec sm" onClick={() => setEdit(v)}>Edit</button>
                  {user.role === 'admin' && <button className="btn danger sm" onClick={() => del(v)}>Delete</button>}
                </div></td>
              </tr>))}
            </tbody>
          </table></div>
        )}
        <Pager page={meta.page} pages={meta.pages} onPage={setPage} />
      </div>
      {edit && (
        <Modal title={'Edit visitor — ' + edit.badge_no} onClose={() => setEdit(null)}>
          <VisitorForm initial={edit} submitLabel="Save changes" onSubmit={save} onCancel={() => setEdit(null)} hosts={hosts} />
        </Modal>
      )}
    </>
  );
}

Object.assign(window, { Visitors });
