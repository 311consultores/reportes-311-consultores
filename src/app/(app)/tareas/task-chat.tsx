"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { FileText, ImageIcon, Paperclip, Send, Smile, X } from "lucide-react";
import { getTaskMessages, sendTaskMessage, type ChatMessage } from "@/app/actions/task-chat";
import { Avatar } from "@/components/avatar";
import { RichTextEditor } from "@/components/rich-text";
import { EMOJI_GROUPS } from "@/lib/emojis";
import { formatMx } from "@/lib/tasks-shared";
import { cn } from "@/lib/utils";

type Pending = { id: string; key: string; type: string; name: string; size: number };
type Gif = { id: string; title: string; preview: string; url: string };

const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Chat de la tarea: conversación entre Admin/Editor y el TEAM 311 asignado, con formato, emojis, GIF y adjuntos. */
export function TaskChat({ taskId, meId }: { taskId: string; meId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [html, setHtml] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [composerKey, setComposerKey] = useState(0);
  const [pending, setPending] = useState<Pending[]>([]);
  const [gif, setGif] = useState<Gif | null>(null);
  const [panel, setPanel] = useState<null | "emoji" | "gif">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const file = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const refresh = useCallback(async () => {
    const m = await getTaskMessages(taskId);
    setMessages(m);
    setLoaded(true);
  }, [taskId]);

  useEffect(() => {
    // Carga inicial y actualización periódica mientras la ventana está abierta
    void getTaskMessages(taskId).then((m) => { setMessages(m); setLoaded(true); });
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [taskId, refresh]);

  useEffect(() => {
    if (messages.length !== count.current) {
      count.current = messages.length;
      end.current?.scrollIntoView({ block: "nearest" });
    }
  }, [messages]);

  async function upload(original: File) {
    setError(undefined);
    setBusy(true);
    try {
      let f = original;
      if (/^image\/(jpeg|png)$/.test(original.type)) {
        const { default: compress } = await import("browser-image-compression");
        const blob = await compress(original, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, fileType: "image/jpeg" });
        f = new File([blob], original.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      }
      const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", headers: { "Content-Type": f.type, "x-filename": encodeURIComponent(original.name) }, body: f });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir el archivo");
      setPending((p) => [...p, data as Pending]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el archivo");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  async function removePending(id: string) {
    setPending((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/tasks/${taskId}/attachments?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }

  async function send() {
    setError(undefined);
    setBusy(true);
    const r = await sendTaskMessage({ taskId, bodyHtml: html, gifUrl: gif?.url ?? null, attachmentIds: pending.map((p) => p.id) });
    setBusy(false);
    if (r.error) return setError(r.error);
    setHtml("");
    setPending([]);
    setGif(null);
    setPanel(null);
    setComposerKey((k) => k + 1);
    await refresh();
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Comentarios</h3>
      <div className="max-h-80 space-y-3 overflow-y-auto rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.04]" aria-live="polite">
        {!loaded && <p className="text-sm text-zinc-500">Cargando…</p>}
        {loaded && messages.length === 0 && <p className="text-sm text-zinc-500">Aún no hay comentarios. ¡Escribe el primero!</p>}
        {messages.map((m) => {
          const mine = m.userId === meId;
          return (
            <div key={m.id} className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
              <Avatar name={m.userName} userId={m.userId} photoKey={m.photoUrl} size={30} />
              <div className={cn("max-w-[85%] space-y-1.5 rounded-2xl px-3.5 py-2 text-sm", mine ? "bg-[#007AFF]/10" : "bg-white dark:bg-white/10")}>
                <p className="text-xs"><span className="font-semibold">{m.userName}</span> <span className="text-zinc-400">· {formatMx(m.createdAt)}</span></p>
                {m.bodyHtml && <div className="[&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: m.bodyHtml }} />}
                {m.gifUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.gifUrl} alt="GIF" className="max-h-48 rounded-xl" />
                )}
                {m.attachments.map((a) => {
                  const src = `/api/files/${a.key}`;
                  if (a.type === "IMAGE") return (
                    <a key={a.id} href={src} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={a.name} className="max-h-48 rounded-xl" />
                    </a>
                  );
                  if (a.type === "VIDEO") return <video key={a.id} src={src} controls className="max-h-56 rounded-xl" />;
                  return (
                    <a key={a.id} href={src} target="_blank" rel="noreferrer" className="link flex items-center gap-1.5 break-all">
                      <FileText size={15} className="shrink-0" /> {a.name} <span className="text-xs text-zinc-400">({fmtSize(a.size)})</span>
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <div className="space-y-2">
        <RichTextEditor key={composerKey} onChange={setHtml} onEditor={setEditor} minHeight={56} />

        {(pending.length > 0 || gif) && (
          <div className="flex flex-wrap gap-2">
            {gif && (
              <span className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gif.preview} alt="GIF elegido" className="h-16 rounded-lg" />
                <button type="button" aria-label="Quitar GIF" onClick={() => setGif(null)} className="glass absolute -right-1.5 -top-1.5 rounded-full p-1"><X size={12} /></button>
              </span>
            )}
            {pending.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-black/5 py-1 pl-3 pr-1.5 text-xs dark:bg-white/10">
                {p.type === "IMAGE" ? <ImageIcon size={13} /> : <FileText size={13} />} {p.name}
                <button type="button" aria-label={`Quitar ${p.name}`} onClick={() => removePending(p.id)} className="rounded-full p-0.5 hover:bg-black/10"><X size={12} /></button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className="btn-outline px-3 py-1.5 text-xs" aria-label="Emojis" onClick={() => setPanel((p) => (p === "emoji" ? null : "emoji"))}><Smile size={14} /> Emoji</button>
          <button type="button" className="btn-outline px-3 py-1.5 text-xs" aria-label="GIF" onClick={() => setPanel((p) => (p === "gif" ? null : "gif"))}>GIF</button>
          <input ref={file} type="file" hidden accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf,.docx,.xlsx,.pptx,.txt,.csv" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button type="button" className="btn-outline px-3 py-1.5 text-xs" disabled={busy} onClick={() => file.current?.click()}><Paperclip size={14} /> Adjuntar</button>
          <button type="button" className="btn ml-auto px-4 py-1.5 text-sm" disabled={busy} onClick={send}><Send size={14} /> Enviar</button>
        </div>

        {panel === "emoji" && (
          <div className="glass max-h-52 space-y-2 overflow-y-auto rounded-2xl p-3">
            {EMOJI_GROUPS.map((g) => (
              <div key={g.name}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{g.name}</p>
                <div className="flex flex-wrap gap-0.5">
                  {g.items.map((e, i) => (
                    <button key={i} type="button" className="rounded-lg p-1 text-xl hover:bg-black/5 dark:hover:bg-white/10" onClick={() => editor?.chain().focus().insertContent(e).run()}>{e}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {panel === "gif" && <GifPanel onPick={(g) => { setGif(g); setPanel(null); }} />}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function GifPanel({ onPick }: { onPick: (g: Gif) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Gif[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "off" | "error">("loading");

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/gifs?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.configured === false) return setState("off");
        if (!res.ok || data.error) return setState("error");
        setResults(data.results);
        setState("ok");
      } catch {
        setState("error");
      }
    }, q ? 400 : 0);
    return () => clearTimeout(t);
  }, [q]);

  if (state === "off") return <p className="glass rounded-2xl p-3 text-xs text-zinc-500">Los GIF todavía no están activados. El Administrador debe configurar la clave de Giphy (GIPHY_API_KEY).</p>;
  return (
    <div className="glass space-y-2 rounded-2xl p-3">
      <input className="input" placeholder="Busca un GIF… (ej. celebrar, café, gracias)" value={q} onChange={(e) => setQ(e.target.value)} />
      {state === "error" && <p className="text-xs text-destructive">No se pudo consultar Giphy. Intenta de nuevo.</p>}
      <div className="grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto">
        {results.map((g) => (
          <button key={g.id} type="button" onClick={() => onPick(g)} className="overflow-hidden rounded-lg hover:ring-2 hover:ring-[#007AFF]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.preview} alt={g.title} className="h-24 w-full object-cover" />
          </button>
        ))}
      </div>
      <p className="text-[10px] text-zinc-400">Powered by GIPHY</p>
    </div>
  );
}
