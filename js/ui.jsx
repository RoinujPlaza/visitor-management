/* VisitorPass - generic UI (Modal, Pager, Empty, Loading) */

/* ============================== generic UI ============================== */
function Modal({ title, onClose, children, small = false }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={'modal' + (small ? ' sm' : '')} onMouseDown={(e) => e.stopPropagation()}>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

function Pager({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null;
  const list = [];
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  for (let i = start; i <= Math.min(pages, start + 4); i++) list.push(i);
  return (
    <div className="pager">
      <button className="btn sec sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="chevron-left" size={15} /> Prev</button>
      {list.map((i) => <button key={i} className={'page-no' + (i === page ? ' on' : '')} onClick={() => onPage(i)}>{i}</button>)}
      <button className="btn sec sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next <Icon name="chevron-right" size={15} /></button>
    </div>
  );
}

function Empty({ children = 'Nothing to show.' }) { return <div className="empty">{children}</div>; }
function Loading() { return <Empty>Loading…</Empty>; }

Object.assign(window, { Modal, Pager, Empty, Loading });
