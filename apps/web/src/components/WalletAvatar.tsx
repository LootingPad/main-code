const GRID = 9;
const HALF = 5;

function cellsFor(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const next = () => {
    hash = Math.imul(hash ^ (hash >>> 13), 2246822519);
    return (hash >>> 0) % 5 > 1;
  };
  const grid: boolean[] = [];
  for (let row = 0; row < GRID; row += 1) {
    const left = Array.from({ length: HALF }, next);
    const mirrored = [...left, ...left.slice(0, HALF - 1).reverse()];
    grid.push(...mirrored);
  }
  return grid;
}

export function WalletAvatar({ address, size = 26 }: { address: string; size?: number }) {
  const cells = cellsFor(address.toLowerCase());
  return (
    <svg className="wallet-avatar" width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`} shapeRendering="crispEdges" aria-hidden>
      <rect width={GRID} height={GRID} fill="#ccff00" />
      {cells.map((filled, index) =>
        filled ? (
          <rect
            key={index}
            x={index % GRID}
            y={Math.floor(index / GRID)}
            width="1"
            height="1"
            fill="#161616"
          />
        ) : null,
      )}
    </svg>
  );
}
