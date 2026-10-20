import { STAFF_ROLES } from "@/lib/roles";
import { requireUser } from "@/lib/auth";
import { AppPanel } from "./app-panel";

export const metadata = { title: "App y avisos | Portal de Operaciones" };

export default async function AppPage() {
  const user = await requireUser(STAFF_ROLES);
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="page-title">App y avisos</h1>
      <AppPanel isOps={user.role === "ADMIN" || user.role === "EDITOR"} />
    </div>
  );
}
