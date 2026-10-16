import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/storage";
import { auditDetails } from "@/lib/consultants";

/** Elimina una actividad, renumera las que quedan, registra el cambio y borra sus evidencias del almacenamiento. */
export async function deleteTaskAndRenumber(taskId: string, userId: string, reason: string): Promise<boolean> {
  const task = await prisma.reportTask.findUnique({ where: { id: taskId }, include: { evidences: true } });
  if (!task) return false;
  await prisma.$transaction(async (tx) => {
    await tx.reportTask.delete({ where: { id: task.id } }); // las evidencias se borran en cascada
    const rest = await tx.reportTask.findMany({ where: { reportId: task.reportId }, orderBy: { sequentialNum: "asc" } });
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].sequentialNum !== i + 1) await tx.reportTask.update({ where: { id: rest[i].id }, data: { sequentialNum: i + 1 } });
    }
    await tx.auditLog.create({
      data: { reportId: task.reportId, userId, action: `DELETED_TASK_${task.sequentialNum}`, details: auditDetails({ reason, title: task.title }) },
    });
  });
  await Promise.all(task.evidences.map((e) => deleteObject(e.url).catch(() => {})));
  return true;
}
