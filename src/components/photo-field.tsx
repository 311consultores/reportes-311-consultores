"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Avatar } from "@/components/avatar";

const SIZE = 320; // la foto se guarda cuadrada y pequeña: pesa poco y llena bien el círculo

/** Selector de foto de perfil: la recorta en cuadro centrado automáticamente y muestra cómo quedará en el círculo. */
export function PhotoField({ name, userId, photoKey, current }: { name: string; userId?: string; photoKey?: string | null; current: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();

  async function pick(file: File) {
    setError(undefined);
    if (!/^image\/(jpeg|png)$/.test(file.type)) return setError("Elige una imagen PNG o JPG");
    try {
      const bmp = await createImageBitmap(file);
      const side = Math.min(bmp.width, bmp.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      canvas.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error("No se pudo procesar la imagen");
      const cropped = new File([blob], "perfil.jpg", { type: "image/jpeg" });
      const dt = new DataTransfer();
      dt.items.add(cropped);
      if (input.current) input.current.files = dt.files; // el formulario enviará la foto ya recortada
      setPreview(URL.createObjectURL(blob));
    } catch {
      setError("No se pudo leer la imagen. Prueba con otra.");
    }
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
        <p className="text-xs text-zinc-500">PNG o JPG. Se recorta en cuadro centrado para el círculo.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <input ref={input} type="file" name={name} accept="image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
    </div>
  );
}
