export type DiffPart = { text: string; op: "same" | "del" | "ins" };

/** Diferencias palabra por palabra entre dos textos (lo quitado y lo agregado), para comparar versiones del copy. */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter((x) => x !== "");
  const b = after.split(/(\s+)/).filter((x) => x !== "");
  const n = a.length;
  const m = b.length;
  // Subsecuencia común más larga
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const parts: DiffPart[] = [];
  const push = (text: string, op: DiffPart["op"]) => {
    const last = parts[parts.length - 1];
    if (last && last.op === op) last.text += text;
    else parts.push({ text, op });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push(a[i], "same"); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) push(a[i++], "del");
    else push(b[j++], "ins");
  }
  while (i < n) push(a[i++], "del");
  while (j < m) push(b[j++], "ins");
  return parts;
}
