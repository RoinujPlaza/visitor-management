/* VisitorPass - dashboard screen */

/* ============================== dashboard ============================== */
function Dashboard({ notify, showBadge, go, settings }) {
  const [stats, setStats] = useState(null);
  const [inside, setInside] = useState([]);
  const [expected, setExpected] = useState([]);

  const load = useCallback(async () => {
    try {
      const [s, l, a] = await Promise.all([
        api('stats'), api('list', null, 'status=in&limit=200'), api('appointments.list'),
      ]);
      setStats(s); setInside(l.visitors);
      setExpected((a.appointments || []).filter((x) => x.status === 'scheduled' && String(x.expected_at).startsWith(todayStr())).slice(0, 6));
    } catch (e) { notify(e.message, 'err'); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const out = async (v) => {
    try { await api('checkout', { id: v.id }); notify(`${v.full_name} checked out`); load(); }
    catch (e) { notify(e.message, 'err'); }
  };

  if (!stats) return <Loading />;
  const max = Math.max(1, ...stats.days.map((d) => d.count));
  const limit = Number(settings.overstay_minutes || 480);

  return (
    <>
      <div className="page-head"><div><h1>Dashboard</h1><p className="sub">Live overview of visitor activity</p></div>
        <button className="btn" onClick={() => go('checkin')}><Icon name="plus-circle" /> New check-in</button></div>
      <div className="grid stats">
        <div className="card stat in"><div className="l">Currently inside</div><div className="n">{stats.inside}</div></div>
        <div className="card stat"><div className="l">Visitors today</div><div className="n">{stats.today}</div></div>
        <div className="card stat"><div className="l">Checked out today</div><div className="n">{stats.checked_out_today}</div></div>
        <div className="card stat"><div className="l">Expected today</div><div className="n">{stats.expected_today}</div></div>
        <div className="card stat"><div className="l">All-time visitors</div><div className="n">{stats.total}</div></div>
      </div>
      {stats.overstay > 0 && <div className="alert warn"><Icon name="alert" size={17} /> {stats.overstay} visitor{stats.overstay > 1 ? 's' : ''} inside longer than {limit} minutes. Follow up with their host.</div>}
      <div className="grid two">
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Currently inside</h3>
          {inside.length === 0 ? <Empty>No visitors inside right now.</Empty> : (
            <div className="tbl"><table>
              <thead><tr><th>Visitor</th><th>Host</th><th>Since</th><th></th></tr></thead>
              <tbody>{inside.map((v) => {
                const mins = (Date.now() - toDate(v.check_in)) / 60000;
                return <tr key={v.id} className={mins > limit ? 'row-warn' : ''}>
                  <td><b>{v.full_name}</b><div className="sub">{v.badge_no}{v.company ? ' • ' + v.company : ''}</div></td>
                  <td>{v.host_name}<div className="sub">{v.purpose}</div></td>
                  <td>{fmt(v.check_in)}<div className="sub">{duration(v.check_in)}</div></td>
                  <td><div className="actions">
                    <button className="btn sec sm" onClick={() => showBadge(v)}>Badge</button>
                    <button className="btn ok sm" onClick={() => out(v)}>Check out</button>
                  </div></td>
                </tr>;
              })}</tbody>
            </table></div>
          )}
        </div>
        <div className="stack">
          <div className="card">
            <h3>Last 7 days</h3>
            <div className="bars">
              {stats.days.map((d) => (
                <div className="bar" key={d.date} title={`${d.date}: ${d.count}`}>
                  <b>{d.count}</b>
                  <i style={{ height: `${(d.count / max) * 100}%` }} />
                  <span>{toDate(d.date + ' 00:00:00').toLocaleDateString('en-PH', { weekday: 'short' })}</span>
                </div>))}
            </div>
          </div>
          <div className="card">
            <h3>Expected today</h3>
            {expected.length === 0 ? <Empty>No expected visitors today.</Empty> : (
              <div className="mini-list">{expected.map((a) => (
                <div className="mini" key={a.id}>
                  <div><b>{a.full_name}</b><div className="sub">{fmt(a.expected_at)} • {a.host_name}</div></div>
                  <button className="btn sec sm" onClick={() => go('appointments')}>View</button>
                </div>))}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Dashboard });
