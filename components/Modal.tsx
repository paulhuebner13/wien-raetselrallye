'use client';

export default function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Schließen">×</button>
        {children}
      </section>
    </div>
  );
}
