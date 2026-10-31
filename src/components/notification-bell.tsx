"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { getNotifications, markAllNotificationsRead, markNotificationRead, unreadCount, type NotificationItem } from "@/app/actions/notifications";
import { Avatar } from "@/components/avatar";
import { usePush } from "@/lib/use-push";
import { formatMx } from "@/lib/tasks-shared";
import { cn } from "@/lib/utils";

const ICON: Record<string, string> = { TASK_ASSIGNED: "📝", TASK_UNASSIGNED: "🚫", GAME_BEATEN: "🏆", TASK_READY: "🔍", TASK_RETURNED: "↩️", TASK_ACCEPTED: "🎉", TASK_MESSAGE: "💬", TASK_SOON: "⏰", TASK_OVERDUE: "⚠️", EDIT_REQUEST: "✏️", REGISTRATION: "🏢", INVOICE_OVERDUE: "💸", NOTE_SHARED: "📒", NOTE_REMINDER: "⏰", REVIEW_SENT: "💬", REVIEW_APPROVED: "✅" };

/** Campanita con globo rojo y lista de avisos del portal. */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const push = usePush();

  // Revisa si hay avisos nuevos cada minuto
  useEffect(() => {
    const t = setInterval(() => void unreadCount().then(setUnread).catch(() => {}), 60_000);
    return () => clearInterval(t);
  }, []);
  // Cierra la lista al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setItems(null);
      const r = await getNotifications();
      setItems(r.items);
      setUnread(r.unread);
    }
  }

  async function go(n: NotificationItem) {
    setOpen(false);
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1));
      void markNotificationRead(n.id);
    }
    router.push(n.link);
  }

  return (
    <div ref={box} className="relative">
      <button type="button" aria-label={unread ? `Avisos (${unread} sin leer)` : "Avisos"} onClick={toggle} className="relative rounded-xl p-2.5 text-zinc-600 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.95] dark:text-zinc-300 dark:hover:bg-white/10">
        <Bell size={18} />
        {unread > 0 && <span className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-[#FF3B30] px-1 text-center text-[10px] font-semibold leading-[18px] text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="glass absolute bottom-full left-0 z-50 mb-2 w-80 max-w-[85vw] overflow-hidden rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.18)]" role="dialog" aria-label="Avisos">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-2.5 dark:border-white/10">
            <p className="text-sm font-semibold">Avisos</p>
            {unread > 0 && (
              <button type="button" className="link inline-flex items-center gap-1 text-xs" onClick={async () => { await markAllNotificationsRead(); setUnread(0); setItems((l) => l?.map((n) => ({ ...n, read: true })) ?? l); }}>
                <CheckCheck size={13} /> Marcar todo como leído
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items === null && <li className="px-4 py-6 text-center text-sm text-zinc-500">Cargando…</li>}
            {items?.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">No tienes avisos todavía.</li>}
            {items?.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => go(n)} className={cn("flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]", !n.read && "bg-[#007AFF]/[0.06]")}>
                  {n.actor ? (
                    <span className="relative mt-0.5 shrink-0">
                      <Avatar name={n.actor.name} userId={n.actor.id} photoKey={n.actor.photoUrl} size={30} />
                      <span className="absolute -bottom-1 -right-1 text-xs">{ICON[n.kind] ?? "🔔"}</span>
                    </span>
                  ) : (
                    <span className="mt-0.5 text-base">{ICON[n.kind] ?? "🔔"}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block", !n.read && "font-semibold")}>{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-zinc-500">{n.body}</span>}
                    <span className="block text-[11px] text-zinc-400">{formatMx(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#007AFF]" />}
                </button>
              </li>
            ))}
          </ul>
          {push.supported && (
            <div className="space-y-1 border-t border-black/5 px-4 py-2.5 text-xs dark:border-white/10">
              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <input type="checkbox" className="h-4 w-4 accent-[#007AFF]" checked={push.subscribed} disabled={push.busy} onChange={(e) => (e.target.checked ? void push.enable() : void push.disable())} />
                Notificaciones del navegador en este dispositivo
              </label>
              {push.error && <p className="text-destructive">{push.error}</p>}
              <Link href="/aplicacion" onClick={() => setOpen(false)} className="link inline-block">Elegir de qué avisarme</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
