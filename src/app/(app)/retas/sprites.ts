/** Sprites en pixel art de Las Retas. Cada renglón es una fila de píxeles; la letra elige el color de la paleta (el punto es transparente). */

export const TLACUACHE_PALETTE: Record<string, string> = { k: "#2d2a32", g: "#8d949e", d: "#646b75", w: "#f3f1f6", p: "#f2a2b8", e: "#15131a" };
export const NOPAL_PALETTE: Record<string, string> = { k: "#1d4b28", g: "#47a35a", d: "#2f7c42" };
export const ZOPILOTE_PALETTE: Record<string, string> = { k: "#1a1a1f", d: "#3a3a44", r: "#d9534f", y: "#f1c24b" };

export const TLACUACHE_RUN_A = [
  "...............kk...",
  "..............kppk..",
  ".....kkkkkk..kkkkk..",
  "...kkggggggkkwwwwk..",
  "..kggggggggkwwwwwwk.",
  ".kgggggggggkwwewwwwk",
  ".kggggggggggwwwwwwpk",
  "pkgggggggggggkwwwkk.",
  "pkggggggggggggkkkk..",
  ".pkkgggggggggkk.....",
  ".pp.kdkkkkkdkk......",
  "..p.kdk....kdk......",
  "..pp.kk....kk.......",
];

export const TLACUACHE_RUN_B = [
  "...............kk...",
  "..............kppk..",
  ".....kkkkkk..kkkkk..",
  "...kkggggggkkwwwwk..",
  "..kggggggggkwwwwwwk.",
  ".kgggggggggkwwewwwwk",
  ".kggggggggggwwwwwwpk",
  "pkgggggggggggkwwwkk.",
  "pkggggggggggggkkkk..",
  ".pkkgggggggggkk.....",
  ".pp.kkdkkkkkkdkk....",
  "..p..kdk..kdk.......",
  "..pp..kk..kk........",
];

export const TLACUACHE_JUMP = [
  "...............kk...",
  "..............kppk..",
  ".....kkkkkk..kkkkk..",
  "...kkggggggkkwwwwk..",
  "..kggggggggkwwwwwwk.",
  ".kgggggggggkwwewwwwk",
  ".kggggggggggwwwwwwpk",
  "pkgggggggggggkwwwkk.",
  "pkggggggggggggkkkk..",
  ".pkkdkkkkkkdkk......",
  ".pp.kkk..kkk........",
];

export const TLACUACHE_DUCK = [
  "..........kk........",
  ".........kppk.......",
  "..kkkkkkkkkkwwkk....",
  ".kggggggggggwwwwwk..",
  "kggggggggggkwwewwwpk",
  "kgggggggggggwwwwwkk.",
  "pkgggggggggggkkkk...",
  "pp.kdkkkkkdkk.......",
  ".p.kdk...kdk........",
];

export const TLACUACHE_DEAD = [
  "...............kk...",
  "..............kppk..",
  ".....kkkkkk..kkkkk..",
  "...kkggggggkkwwwwk..",
  "..kggggggggkwwwwwwk.",
  ".kgggggggggkwwkwkwwk",
  ".kggggggggggwwwkwwpk",
  "pkgggggggggggkwkwkk.",
  "pkggggggggggggkkkk..",
  ".pkkgggggggggkk.....",
  ".pp.kdkkkkkdkk......",
  "..p.kdk....kdk......",
  "..pp.kk....kk.......",
];

export const NOPAL_SMALL = [
  "....kk....",
  "...kggk...",
  "...kggk.kk",
  "kk.kggkkgk",
  "kgkkggkgdk",
  "kgkkggkgdk",
  ".kkkggkgk.",
  "...kggkk..",
  "...kggk...",
  "...kgdk...",
  "...kgdk...",
  "..kkgdkk..",
];

export const NOPAL_BIG = [
  "....kkk.....",
  "...kgggk....",
  "...kgggk.kk.",
  "kk.kgggkkggk",
  "kgkkgggkgddk",
  "kgkkgggkgddk",
  "kgdkgggkgdk.",
  ".kkkgggkgk..",
  "...kgggkk...",
  "...kgggk....",
  "...kgddk....",
  "...kgddk....",
  "...kgddk....",
  "...kgddk....",
  "...kgddk....",
  "..kkgddkk...",
  "..kkkkkkk...",
];

export const ZOPILOTE_A = [
  "......kk........",
  ".....kddk.......",
  "....kdddk...kk..",
  "...kddddkkkkddk.",
  "kkkddddddddddkky",
  "..kkddddddddk.ry",
  "....kkddddkk..r.",
  "......kkkk......",
];

export const ZOPILOTE_B = [
  "................",
  "................",
  "...kkkk....kk...",
  "..kddddkkkkddk..",
  "kkddddddddddkkky",
  ".kkdddddddddk.ry",
  "...kkddddddk..r.",
  ".....kkkkk......",
];
