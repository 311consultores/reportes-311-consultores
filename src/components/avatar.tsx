import { cn } from "@/lib/utils";
import { avatarColor, initialsOf } from "@/lib/avatar-style";

/** Foto circular; sin foto muestra las iniciales sobre un color propio de cada persona. */
export function Avatar({ name, userId, photoKey, size = 28, className }: { name: string; userId?: string | null; photoKey?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.4)) };
  if (userId && photoKey) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/users/${userId}/photo?v=${encodeURIComponent(photoKey)}`} alt={name} style={style} className={cn("shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-zinc-900", className)} />
    );
  }
  return (
    <span
      aria-label={name}
      style={{ ...style, backgroundColor: avatarColor(name) }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white dark:ring-zinc-900", className)}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Foto + nombre en una "pastilla", como en Monday o Trello. */
export function AvatarChip({ name, userId, photoKey, size = 28 }: { name: string; userId?: string | null; photoKey?: string | null; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] py-1 pl-1 pr-3 text-sm dark:bg-white/[0.08]">
      <Avatar name={name} userId={userId} photoKey={photoKey} size={size} />
      <span className="truncate">{name}</span>
    </span>
  );
}
