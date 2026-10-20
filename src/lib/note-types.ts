/** Tipos y colores del Baúl (sin acceso a la base de datos: se usan en el servidor y en el navegador). */
export type NoteItemData = { id: string; text: string; done: boolean };

export type NoteCard = {
  id: string;
  mine: boolean;
  canEdit: boolean;
  ownerId: string;
  ownerName: string;
  ownerPhoto: string | null;
  kind: "TEXT" | "CHECKLIST";
  title: string;
  bodyHtml: string;
  items: NoteItemData[];
  color: string;
  pinned: boolean;
  position: number;
  archived: boolean;
  trashedAt: string | null;
  reminderAt: string | null;
  labelIds: string[];
  shares: { userId: string; name: string; photoUrl: string | null; canEdit: boolean }[]; // solo las ve el dueño
  link: { clientId: string | null; clientName: string | null; projectId: string | null; projectName: string | null; taskId: string | null; taskTitle: string | null };
  updatedAt: string;
};

export type NoteColor = { id: string; label: string; bg: string; swatch: string };

/** Paleta pastel (con su versión para modo oscuro). */
export const NOTE_COLORS: NoteColor[] = [
  { id: "white", label: "Blanco", bg: "bg-white dark:bg-zinc-800", swatch: "#FFFFFF" },
  { id: "red", label: "Rojo", bg: "bg-[#FDDCDC] dark:bg-[#5C2B29]", swatch: "#FDDCDC" },
  { id: "orange", label: "Naranja", bg: "bg-[#FDE6CC] dark:bg-[#614A19]", swatch: "#FDE6CC" },
  { id: "yellow", label: "Amarillo", bg: "bg-[#FFF5BF] dark:bg-[#635D19]", swatch: "#FFF5BF" },
  { id: "green", label: "Verde", bg: "bg-[#DDF3D5] dark:bg-[#345920]", swatch: "#DDF3D5" },
  { id: "teal", label: "Turquesa", bg: "bg-[#CFF3EC] dark:bg-[#16504B]", swatch: "#CFF3EC" },
  { id: "blue", label: "Azul", bg: "bg-[#D6E8FD] dark:bg-[#2D555E]", swatch: "#D6E8FD" },
  { id: "purple", label: "Morado", bg: "bg-[#E6DAF8] dark:bg-[#42275E]", swatch: "#E6DAF8" },
  { id: "pink", label: "Rosa", bg: "bg-[#FADDEB] dark:bg-[#5B2245]", swatch: "#FADDEB" },
  { id: "gray", label: "Gris", bg: "bg-[#E8EAED] dark:bg-[#3C3F43]", swatch: "#E8EAED" },
];

export const noteBg = (id: string) => (NOTE_COLORS.find((c) => c.id === id) ?? NOTE_COLORS[0]).bg;
export const TRASH_DAYS = 30;
