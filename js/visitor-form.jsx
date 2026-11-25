/* VisitorPass - visitor form and printable badge */

/* ============================== visitor form ============================== */
function VisitorForm({ initial = EMPTY, submitLabel, onSubmit, onCancel, hosts = [] }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pickHost = (e) => {
    const name = e.target.value;
    const h = hosts.find((x) => x.name.toLowerCase() === name.toLowerCase());
    setF({ ...f, host_name: name, host_id: h ? h.id : '', department: h && h.department ? h.department : f.department });
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await onSubmit(f); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <div className="form">
        <div className="full"><label>Full name <span className="req">*</span></label><input required value={f.full_name} onChange={set('full_name')} /></div>
        <div><label>Company / Organization</label><input value={f.company} onChange={set('company')} /></div>
        <div><label>Phone</label><input value={f.phone} onChange={set('phone')} /></div>
        <div><label>Email</label><input type="email" value={f.email} onChange={set('email')} /></div>
        <div><label>ID type</label>
          <select value={f.id_type} onChange={set('id_type')}>
            <option value="">— Select —</option>
            {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div><label>ID number</label><input value={f.id_number} onChange={set('id_number')} /></div>
        <div><label>Purpose of visit <span className="req">*</span></label>
          <select required value={f.purpose} onChange={set('purpose')}>
            <option value="">— Select —</option>
            {PURPOSES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div><label>Person to visit (host) <span className="req">*</span></label>
          <input required list="host-options" value={f.host_name} onChange={pickHost} placeholder="Start typing a name…" />
          <datalist id="host-options">{hosts.filter((h) => h.active).map((h) => <option key={h.id} value={h.name}>{h.department || ''}</option>)}</datalist>
        </div>
        <div><label>Department</label><input value={f.department} onChange={set('department')} /></div>
        <div className="full"><label>Notes</label><textarea rows="2" value={f.notes} onChange={set('notes')} /></div>
      </div>
      <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" className="btn sec" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

/* ============================== badge ============================== */
function BadgeModal({ v, company, footer, onClose }) {
  const qr = useRef(null);
  useEffect(() => {
    if (!qr.current) return;
    qr.current.innerHTML = '';
    if (v.qr_token && window.QRCode) {
      try {
        new QRCode(qr.current, {
          text: v.qr_token, width: 130, height: 130,
          colorDark: '#1c2333', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M,
        });
      } catch (e) { qr.current.textContent = v.qr_token; }
    } else {
      qr.current.textContent = v.badge_no;
    }
  }, [v.qr_token, v.badge_no]);
  return (
    <Modal onClose={onClose} small>
      <div className="badge-card">
        <div className="tag">VISITOR</div>
        <div className="brand-sm">{company || 'VisitorPass'}</div>
        <div className="nm">{v.full_name}</div>
        <div className="no">{v.badge_no}</div>
        <div className="qr" ref={qr} />
        <dl>
          <dt>Company</dt><dd>{v.company || '—'}</dd>
          <dt>Visiting</dt><dd>{v.host_name}</dd>
          <dt>Purpose</dt><dd>{v.purpose}</dd>
          <dt>In</dt><dd>{fmt(v.check_in)}</dd>
        </dl>
        <div className="badge-foot">{footer || 'Please wear this badge visibly at all times.'}</div>
      </div>
      <div className="modal-actions no-print">
        <button className="btn sec" onClick={onClose}>Close</button>
        <button className="btn" onClick={() => window.print()}><Icon name="printer" /> Print badge</button>
      </div>
    </Modal>
  );
}

Object.assign(window, { VisitorForm, BadgeModal });
