/* VisitorPass - reports screen */

/* ============================== reports ============================== */
function Reports({ notify, settings }) {
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 86400000).toLocaleDateString('en-CA'));
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { setData(await api('report', null, esc({ from, to }))); }
    catch (e) { notify(e.message, 'err'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const max = data ? Math.max(1, ...data.by_day.map((d) => d.count)) : 1;
  return (
    <>
      <div className="page-head">
        <div><h1>Reports</h1><p className="sub">Visitor trends and activity summaries</p></div>
        <div className="row-gap no-print">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Generate'}</button>
          <a className="btn sec" href={'api/index.php?action=export&' + esc({ from, to })}><Icon name="download" /> CSV</a>
          <button className="btn sec" onClick={() => {
            document.body.classList.add('print-report');
            const done = () => { document.body.classList.remove('print-report'); window.removeEventListener('afterprint', done); };
            window.addEventListener('afterprint', done);
            window.print();
          }}><Icon name="printer" /> Print</button>
        </div>
      </div>
      {!data ? <Loading /> : <>
        <div className="grid stats">
          <div className="card stat in"><div className="l">Total check-ins</div><div className="n">{data.summary.total}</div></div>
          <div className="card stat"><div className="l">Currently inside</div><div className="n">{data.summary.inside}</div></div>
          <div className="card stat"><div className="l">Checked out</div><div className="n">{data.summary.checked_out}</div></div>
          <div className="card stat"><div className="l">Avg. visit</div><div className="n">{Math.round(data.summary.avg_minutes)}<small style={{ fontSize: 14 }}> min</small></div></div>
        </div>
        <div className="grid two">
          <div className="card">
            <h3>Daily check-ins</h3>
            <div className="bars wide">
              {data.by_day.length === 0 ? <Empty>No data in this range.</Empty> : data.by_day.map((d) => (
                <div className="bar" key={d.date} title={`${d.date}: ${d.count}`}>
                  <b>{d.count}</b><i style={{ height: `${(d.count / max) * 100}%` }} />
                  <span>{String(d.date).slice(5)}</span>
                </div>))}
            </div>
          </div>
          <div className="card">
            <h3>By purpose</h3>
            {data.by_purpose.length === 0 ? <Empty>No data.</Empty> : (
              <div className="mini-list">{data.by_purpose.map((p) => (
                <div className="mini" key={p.purpose}><span>{p.purpose}</span><b>{p.count}</b></div>))}</div>
            )}
          </div>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Top hosts</h3>
          {data.by_host.length === 0 ? <Empty>No data.</Empty> : (
            <div className="tbl"><table>
              <thead><tr><th>Host</th><th>Visits</th><th>Average duration</th></tr></thead>
              <tbody>{data.by_host.map((h) => <tr key={h.host_name}>
                <td><b>{h.host_name}</b></td><td>{h.count}</td><td>{Math.round(h.avg_minutes || 0)} min</td>
              </tr>)}</tbody>
            </table></div>
          )}
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Check-in log ({data.rows.length} shown)</h3>
          <div className="tbl"><table>
            <thead><tr><th>Badge</th><th>Name</th><th>Host</th><th>Check in</th><th>Check out</th><th>Status</th></tr></thead>
            <tbody>{data.rows.map((v) => <tr key={v.id}>
              <td><code>{v.badge_no}</code></td><td>{v.full_name}</td><td>{v.host_name}</td>
              <td>{fmt(v.check_in)}</td><td>{fmt(v.check_out)}</td>
              <td><span className={'pill ' + v.status}>{v.status}</span></td>
            </tr>)}</tbody>
          </table></div>
        </div>
      </>}
    </>
  );
}

Object.assign(window, { Reports });
