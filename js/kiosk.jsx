/* VisitorPass - self-service kiosk screen */

/* ============================== kiosk ============================== */
function Kiosk({ notify, showBadge, go }) {
  const [q, setQ] = useState('');
  const [visitor, setVisitor] = useState(null);
  const [loading, setLoading] = useState(false);
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  const lookup = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const d = await api('lookup', null, 'q=' + encodeURIComponent(q.trim()));
      if (!d.visitor) { notify('No visitor matches that badge, QR code, phone or ID', 'err'); setVisitor(null); }
      else setVisitor(d.visitor);
    } catch (x) { notify(x.message, 'err'); }
    setLoading(false);
  };
  const checkout = async () => {
    try {
      await api('quick_checkout', { q: visitor.qr_token || visitor.badge_no });
      notify(`${visitor.full_name} checked out`);
      setVisitor(null); setQ(''); input.current?.focus();
    } catch (e) { notify(e.message, 'err'); }
  };
  return (
    <div className="kiosk">
      <h1>Self-Service Kiosk</h1>
      <p className="sub">Scan the QR code or type the badge number to look up a visitor.</p>
      <form className="kiosk-search" onSubmit={lookup}>
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Badge number / QR token / phone / ID" />
        <button className="btn" disabled={loading}>{loading ? 'Searching…' : 'Look up'}</button>
      </form>
      {visitor && (
        <div className="card kiosk-card">
          <div className="row-between">
            <div>
              <div className="sub">BADGE</div><div className="kiosk-no">{visitor.badge_no}</div>
              <h2>{visitor.full_name}</h2>
              <p className="sub">{visitor.company || '—'} • visiting {visitor.host_name} • {visitor.purpose}</p>
              <p className="sub">Checked in {fmt(visitor.check_in)} • {duration(visitor.check_in)}</p>
            </div>
            <span className={'pill big ' + visitor.status}>{visitor.status === 'in' ? 'INSIDE' : 'CHECKED OUT'}</span>
          </div>
          <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
            {visitor.status === 'in' && <button className="btn ok" onClick={checkout}><Icon name="check" /> Check out now</button>}
            <button className="btn sec" onClick={() => showBadge(visitor)}>View badge</button>
            <button className="btn sec" onClick={() => { setVisitor(null); setQ(''); input.current?.focus(); }}>Clear</button>
          </div>
        </div>
      )}
      <div className="kiosk-foot">
        <button className="btn sec" onClick={() => go('checkin')}><Icon name="plus-circle" /> New visitor check-in</button>
      </div>
    </div>
  );
}

Object.assign(window, { Kiosk });
