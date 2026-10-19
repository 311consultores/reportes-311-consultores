/**
 * Limpia el HTML que produce el editor de texto del chat: solo se conservan etiquetas de formato simple
 * y se descartan todos los atributos. El texto ya viene escapado por el editor.
 */
const ALLOWED = new Set(["p", "strong", "em", "b", "i", "ul", "ol", "li", "br", "code"]);

export function sanitizeRichHtml(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)[^>]*>/g, (_m, close: string, tag: string) => (ALLOWED.has(tag.toLowerCase()) ? `<${close}${tag.toLowerCase()}>` : ""))
    .slice(0, 20_000);
}

/** Texto plano (para resúmenes en correos y avisos). */
export const htmlToText = (html: string) =>
  html
    .replace(/<\/(p|li)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
