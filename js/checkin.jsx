/* VisitorPass - check-in screen */

/* ============================== check-in ============================== */
function CheckIn({ notify, showBadge, hosts, prefill, clearPrefill }) {
  const [k, setK] = useState(0);
  const submit = async (f) => {
    try {
      const { visitor } = await api('create', f);
      notify(`Checked in: ${visitor.badge_no}`);
      setK(k + 1); clearPrefill();
      showBadge(visitor);
    } catch (e) { notify(e.message, 'err'); }
  };
  return (
    <>
      <div className="page-head"><div><h1>Visitor Check-in</h1><p className="sub">Fill in the details, then print the badge.</p></div></div>
      <div className="card"><VisitorForm key={k + (prefill ? 'p' : '')} initial={prefill || EMPTY} submitLabel="Check in & generate badge" onSubmit={submit} hosts={hosts} /></div>
    </>
  );
}

Object.assign(window, { CheckIn });
