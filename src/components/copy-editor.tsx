"use client";

import { useRef, useState } from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS: { label: string; items: string }[] = [
  { label: "Caras", items: "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😎 🤩 🥳 🤔 😮 😢 😭 😡 🙌 👏 🙏 💪 👍 👎 👌 ✌️ 🤝 👀" },
  { label: "Símbolos", items: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💯 ✨ ⭐ 🌟 🔥 💥 ⚡ ✅ ❌ ⚠️ ❗ ❓ ➡️ ⬇️ 👉 👈 👆 👇 📍 📌 📢 🔔 🎯 🏆 🥇" },
  { label: "Negocios", items: "💼 📈 📊 💰 💵 💳 🏢 🏗️ 🏠 🏡 🔧 🛠️ ⚙️ 🚚 📦 🛒 🛍️ 🎁 📅 ⏰ 📞 📱 💻 📧 🌐 🔗 📣 🎥 📸 🖼️" },
  { label: "Celebración", items: "🎉 🎊 🎈 🎂 🥂 🍾 🎄 🎅 🎆 🎇 🇲🇽 🌮 ☕ 🍕 🍔 🌴 ☀️ 🌙 🌈 🌸 🌱 🐶 🐱 ⚽ 🏃 🚗 ✈️ 🏖️" },
];

/**
 * Campo de texto para el copy de una publicación: texto simple (como saldrá en redes sociales) con selector de emojis,
 * saltos de línea y contador de caracteres.
 */
export function CopyEditor({ id, value, onChange, max, rows = 6, placeholder }: {
  id?: string; value: string; onChange: (v: string) => void; max: number; rows?: number; placeholder?: string;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(0);

  function insert(emoji: string) {
    const el = ta.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = (value.slice(0, start) + emoji + value.slice(end)).slice(0, max);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = Math.min(start + emoji.length, next.length);
      el?.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-black/10 bg-black/[0.03] px-2 py-1.5 dark:border-white/15 dark:bg-white/[0.05]">
        <button type="button" aria-expanded={open} aria-label="Insertar un emoji" onClick={() => setOpen((v) => !v)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10", open && "bg-[#007AFF]/10 text-[#007AFF]")}>
          <Smile size={16} /> Emojis
        </button>
        <span className={cn("text-xs", value.length > max ? "text-destructive" : "text-zinc-500")}>{value.length} / {max}</span>
      </div>
      {open && (
        <div className="absolute left-0 top-10 z-30 w-[min(22rem,100%)] rounded-xl border border-black/10 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.15)] dark:border-white/15 dark:bg-zinc-900">
          <div className="mb-1.5 flex gap-1">
            {GROUPS.map((g, i) => <button key={g.label} type="button" onClick={() => setGroup(i)} className={cn("rounded-full px-2.5 py-0.5 text-xs", group === i ? "bg-foreground text-background" : "hover:bg-black/5 dark:hover:bg-white/10")}>{g.label}</button>)}
          </div>
          <div className="flex max-h-40 flex-wrap gap-0.5 overflow-auto">
            {GROUPS[group].items.split(" ").map((e) => <button key={e} type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => insert(e)} className="h-8 w-8 rounded-lg text-xl leading-none hover:bg-black/5 dark:hover:bg-white/10">{e}</button>)}
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">También puedes usar el teclado de emojis de tu equipo (Windows: tecla Windows + punto).</p>
        </div>
      )}
      <textarea
        ref={ta} id={id} rows={rows} maxLength={max} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="input !rounded-t-none text-[15px] leading-relaxed"
      />
    </div>
  );
}
