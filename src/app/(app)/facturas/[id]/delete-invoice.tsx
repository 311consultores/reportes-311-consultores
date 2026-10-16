"use client";

import { useRouter } from "next/navigation";
import { DeleteButton } from "@/components/delete-button";

export function DeleteInvoice({ id, isAdmin, alreadyPending }: { id: string; isAdmin: boolean; alreadyPending: boolean }) {
  const router = useRouter();
  return (
    <DeleteButton
      targetType="INVOICE"
      targetId={id}
      isAdmin={isAdmin}
      alreadyPending={alreadyPending}
      onExecuted={() => router.push("/facturas")}
      label="Solicitar eliminación"
    />
  );
}
