import { requireUser } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/roles";
import { getRetas } from "@/app/actions/retas";
import { RetasApp } from "./retas-app";

export const metadata = { title: "Las Retas | Portal de Operaciones" };

export default async function RetasPage() {
  const me = await requireUser(STAFF_ROLES); // el CLIENTE no entra
  const initial = await getRetas();
  return <RetasApp initial={initial} meId={me.id} isAdmin={me.role === "ADMIN"} />;
}
