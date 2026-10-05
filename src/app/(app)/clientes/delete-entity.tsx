"use client";

import { useRouter } from "next/navigation";
import { DeleteButton } from "@/components/delete-button";

export function DeleteEntity({ type, id }: { type: "CLIENT" | "PROJECT"; id: string }) {
  const router = useRouter();
  return (
    <DeleteButton
      targetType={type}
      targetId={id}
      isAdmin
      alreadyPending={false}
      onExecuted={() => router.refresh()}
      label="Eliminar"
    />
  );
}
