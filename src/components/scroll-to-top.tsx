"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/** Botón flotante para volver arriba: aparece al bajar un buen tramo en listas largas. */
export function ScrollToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="Subir al inicio"
      title="Subir"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-24 left-6 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[#007AFF] text-white shadow-lg transition-all duration-200 ease-out hover:scale-105 active:scale-95 lg:bottom-24 lg:left-auto lg:right-6"
    >
      <ArrowUp size={20} />
    </button>
  );
}

