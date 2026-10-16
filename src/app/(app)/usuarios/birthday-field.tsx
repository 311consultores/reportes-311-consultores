const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Cumpleaños: solo día y mes. */
export function BirthdayField({ value }: { value?: string | null }) {
  const [m, d] = value ? value.split("-") : ["", ""];
  return (
    <div className="flex gap-2">
      <select name="birthMonth" className="input" defaultValue={m ? String(Number(m)) : ""} aria-label="Mes de cumpleaños">
        <option value="">Mes</option>
        {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <select name="birthDay" className="input w-24" defaultValue={d ? String(Number(d)) : ""} aria-label="Día de cumpleaños">
        <option value="">Día</option>
        {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select>
    </div>
  );
}

export const formatBirthday = (v: string | null) => {
  if (!v) return "—";
  const [m, d] = v.split("-");
  return `${Number(d)} de ${MONTHS[Number(m) - 1]}`;
};
