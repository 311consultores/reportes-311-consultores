"use client";

import { useTransition } from "react";
import { Moon, Sun } from "lucide-react";
import { setTheme } from "@/app/actions/settings";

/** Alterna claro/oscuro. Se guarda por usuario; mientras no se use, sigue al sistema operativo. */
export function ThemeToggle() {
  const [, start] = useTransition();

  function toggle() {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    start(() => {
      void setTheme(next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Cambiar modo claro/oscuro"
      aria-label="Cambiar modo claro u oscuro"
      className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.95] dark:text-zinc-300 dark:hover:bg-white/10"
    >
      <Moon size={18} className="dark:hidden" />
      <Sun size={18} className="hidden dark:block" />
    </button>
  );
}
