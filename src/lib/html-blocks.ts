/**
 * Convierte el HTML de Tiptap (p, strong, em, ul/ol/li, br, h*) en bloques
 * de texto plano con estilo, para renderizarlos en el PDF.
 */
export type Run = { text: string; bold: boolean; italic: boolean };
export type Block = { prefix: string; runs: Run[] };

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m);

export function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const lists: { ordered: boolean; n: number }[] = [];
  let runs: Run[] = [];
  let prefix = "";
  let bold = 0;
  let italic = 0;

  const flush = () => {
    if (runs.some((r) => r.text.trim())) blocks.push({ prefix, runs });
    runs = [];
    prefix = "";
  };

  for (const tok of html.split(/(<[^>]+>)/).filter(Boolean)) {
    if (!tok.startsWith("<")) {
      runs.push({ text: decode(tok), bold: bold > 0, italic: italic > 0 });
      continue;
    }
    const m = tok.match(/^<(\/?)([a-z0-9]+)/i);
    if (!m) continue;
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();

    if (tag === "strong" || tag === "b") bold += closing ? -1 : 1;
    else if (tag === "em" || tag === "i") italic += closing ? -1 : 1;
    else if (tag === "ul" || tag === "ol") {
      if (closing) lists.pop();
      else lists.push({ ordered: tag === "ol", n: 0 });
    } else if (tag === "li") {
      if (closing) flush();
      else {
        flush();
        const l = lists[lists.length - 1];
        const indent = "    ".repeat(Math.max(lists.length - 1, 0));
        prefix = l ? indent + (l.ordered ? `${++l.n}. ` : "• ") : "";
      }
    } else if (tag === "p" || /^h[1-6]$/.test(tag)) {
      if (closing) flush(); // el prefijo de <li> se consume en el primer párrafo del item
    } else if (tag === "br") {
      runs.push({ text: "\n", bold: false, italic: false });
    }
  }
  flush();
  return blocks;
}
