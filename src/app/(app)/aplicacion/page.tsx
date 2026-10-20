import { requireUser } from "@/lib/auth";
import { AppPanel } from "./app-panel";

export const metadata = { title: "App y avisos | Portal de Operaciones" };

export default async function AppPage() {
  const user = await requireUser(["ADMIN", "EDITOR", "TEAM_311"]);
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="page-title">App y avisos</h1>
      <AppPanel isOps={user.role !== "TEAM_311"} />
    </div>
  );
}
