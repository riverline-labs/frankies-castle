const PACKS = [
  { id: 'jar', name: 'Specimen Jar', tokens: 500, note: '' },
  { id: 'cache', name: 'Galvanic Cache', tokens: 3000, note: 'includes 500 bonus' },
  { id: 'reserve', name: 'Reanimation Reserve', tokens: 7500, note: 'includes 1,500 bonus' },
  { id: 'bolt', name: 'Bolt of Lightning', tokens: 20000, note: 'includes 5,000 bonus' },
];

export function Vault({
  open,
  onClose,
  onGrant,
}: {
  open: boolean;
  onClose: () => void;
  onGrant: (tokens: number) => void;
}) {
  if (!open) return null;
  return (
    <div className="vault-back" onClick={onClose}>
      <aside className="vault" role="dialog" aria-label="Voltage Vault" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>Voltage Vault</h2>
            <p>Play-money tokens for the laboratory. One click grants a pack. Nothing here is a charge.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {PACKS.map((pack) => (
          <button
            key={pack.id}
            type="button"
            className="pack"
            data-testid={`pack-${pack.id}`}
            onClick={() => onGrant(pack.tokens)}
          >
            <span className="pack-name">{pack.name}</span>
            <span className="pack-amt">{pack.tokens.toLocaleString()}</span>
            {pack.note ? <span className="pack-note">{pack.note}</span> : <span className="pack-note">tokens</span>}
            <span className="pack-go">Grant</span>
          </button>
        ))}
        <footer>Tokens are play money and have no cash value.</footer>
      </aside>
    </div>
  );
}
