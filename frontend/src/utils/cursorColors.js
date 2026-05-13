const CURSOR_COLORS = [
  '#f87171', // red
  '#fb923c', // orange
  '#facc15', // yellow
  '#4ade80', // green
  '#34d399', // emerald
  '#22d3ee', // cyan
  '#818cf8', // indigo
  '#c084fc', // purple
  '#f472b6', // pink
  '#a78bfa', // violet
  '#2dd4bf', // teal
  '#fb7185', // rose
];

const assigned = {};

export function getCursorColor(userId) {
  if (!assigned[userId]) {
    const idx = Object.keys(assigned).length % CURSOR_COLORS.length;
    assigned[userId] = CURSOR_COLORS[idx];
  }
  return assigned[userId];
}
