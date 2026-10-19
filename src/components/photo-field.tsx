"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ZoomIn, ZoomOut } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";

const OUT = 320; // la foto se guarda cuadrada y pequeña: pesa poco y llena bien el círculo
const BOX = 288; // lado (px) del recuadro de recorte en pantalla

type Src = { url: string; w: number; h: number };

/**
 * Selector de foto de perfil con recorte tipo Facebook: al elegir la foto se abre una ventana donde se arrastra
 * para centrar, se acerca con la barra o la rueda del ratón y se ve cómo quedará dentro del círculo.
 */
export function PhotoField({ name, userId, photoKey, current }: { name: string; userId?: string; photoKey?: string | null; current: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const [src, setSrc] = useState<Src | null>(null);
  const [zoom, setZoom] = useState(1); // 1 = la foto apenas cubre el recuadro
  const [pos, setPos] = useState({ x: 0, y: 0 }); // desplazamiento del centro de la foto respecto al centro del recuadro
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  const base = src ? Math.max(BOX / src.w, BOX / src.h) : 1; // escala mínima que cubre el recuadro
  const scale = base * zoom;

  /** Mantiene la foto cubriendo siempre todo el recuadro. */
  function clamp(p: { x: number; y: number }, z: number) {
    if (!src) return p;
    const s = base * z;
    const mx = Math.max(0, (src.w * s - BOX) / 2);
    const my = Math.max(0, (src.h * s - BOX) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  }
  const setZ = (z: number) => {
    const nz = Math.min(4, Math.max(1, z));
    setZoom(nz);
    setPos((p) => clamp(p, nz));
  };

  function pick(file: File) {
    setError(undefined);
    if (!/^image\/(jpeg|png)$/.test(file.type)) return setError("Elige una imagen PNG o JPG");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSrc({ url, w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setPos({ x: 0, y: 0 });
    };
    img.onerror = () => setError("No se pudo leer la imagen. Prueba con otra.");
    img.src = url;
  }

  function cancel() {
    if (src) URL.revokeObjectURL(src.url);
    setSrc(null);
    if (input.current) input.current.value = ""; // no se envía ninguna foto nueva
  }

  async function apply() {
    if (!src) return;
    const img = new Image();
    img.src = src.url;
    await img.decode();
    // Zona de la foto original que queda dentro del recuadro
    const sw = BOX / scale;
    const sx = src.w / 2 - pos.x / scale - sw / 2;
    const sy = src.h / 2 - pos.y / scale - sw / 2;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = OUT;
    canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sw, 0, 0, OUT, OUT);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob) return setError("No se pudo procesar la imagen");
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "perfil.jpg", { type: "image/jpeg" }));
    if (input.current) input.current.files = dt.files; // el formulario enviará la foto ya recortada
    setPreview(URL.createObjectURL(blob));
    URL.revokeObjectURL(src.url);
    setSrc(null);
  }

  return (
    <div className="flex items-center gap-4">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Vista previa" className="h-16 w-16 rounded-full object-cover ring-2 ring-white dark:ring-zinc-900" />
      ) : (
        <Avatar name={current || "?"} userId={userId} photoKey={photoKey} size={64} />
      )}
      <div className="space-y-1">
        <button type="button" className="btn-outline" onClick={() => input.current?.click()}>
          <Camera size={16} /> {preview || photoKey ? "Cambiar foto" : "Subir foto"}
        </button>
        <p className="text-xs text-zinc-500">PNG o JPG. Podrás acercar y centrar la foto en el círculo.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <input ref={input} type="file" name={name} accept="image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />

      {/* En un portal: dentro de otra ventana emergente (con desenfoque) la capa fija quedaría atrapada en ella */}
      {src && createPortal(
      <Modal open onClose={cancel} title="Ajustar foto de perfil" subtitle="Arrastra para centrar y usa la barra para acercar">
        {src && (
          <div className="space-y-4">
            <div
              className="relative mx-auto touch-none select-none overflow-hidden rounded-2xl bg-black/80"
              style={{ width: BOX, height: BOX, cursor: "grab" }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                setPos(clamp({ x: drag.current.x + e.clientX - drag.current.px, y: drag.current.y + e.clientY - drag.current.py }, zoom));
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onWheel={(e) => setZ(zoom - e.deltaY * 0.002)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{
                  width: src.w * scale,
                  height: src.h * scale,
                  left: BOX / 2 - (src.w * scale) / 2 + pos.x,
                  top: BOX / 2 - (src.h * scale) / 2 + pos.y,
                }}
              />
              {/* Máscara: lo que queda fuera del círculo se oscurece */}
              <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(0,0,0,0.55)] ring-2 ring-white/80" />
            </div>
            <div className="flex items-center gap-3">
              <ZoomOut size={16} className="text-zinc-500" />
              <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZ(Number(e.target.value))} className="flex-1 accent-[#007AFF]" aria-label="Zoom" />
              <ZoomIn size={16} className="text-zinc-500" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={cancel}>Cancelar</button>
              <button type="button" className="btn" onClick={apply}>Aplicar</button>
            </div>
          </div>
        )}
      </Modal>,
      document.body,
      )}
    </div>
  );
}
