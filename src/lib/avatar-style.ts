// Estilo común de los avatares (pantalla y PDF): color propio de cada persona e iniciales.
const COLORS = ["#007AFF", "#34C759", "#FF9500", "#AF52DE", "#FF2D55", "#5AC8FA", "#FFB300", "#30B0C7"];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const avatarColor = (name: string) => COLORS[hash(name) % COLORS.length];

export const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";
