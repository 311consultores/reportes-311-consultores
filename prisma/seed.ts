import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@311consultores.com";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error("Define SEED_ADMIN_PASSWORD en .env");

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: "Administrador 311",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
    },
  });
  console.log(`Admin listo: ${email}`);

  // Usuario editor opcional, útil para probar flujos de aprobación en desarrollo
  const editorPassword = process.env.SEED_EDITOR_PASSWORD;
  if (editorPassword) {
    const editorEmail = process.env.SEED_EDITOR_EMAIL ?? "editor@311consultores.com";
    await prisma.user.upsert({
      where: { email: editorEmail },
      update: {},
      create: {
        name: "Editor Demo",
        email: editorEmail,
        passwordHash: await bcrypt.hash(editorPassword, 12),
        role: "EDITOR",
      },
    });
    console.log(`Editor listo: ${editorEmail}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
