// Genera el SQL para crear el primer administrador sin ejecutar el seed en el servidor.
// Uso: node scripts/hash-password.mjs "correo@dominio.com" "Nombre" "ContraseñaSegura"
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password || password.length < 12) {
  console.error('Uso: node scripts/hash-password.mjs "correo" "Nombre" "Contraseña (mín. 12 caracteres)"');
  process.exit(1);
}
const q = (s) => `'${s.replaceAll("'", "''")}'`;
const hash = await bcrypt.hash(password, 12);

console.log(`INSERT INTO "User" ("id","name","email","passwordHash","role","active","createdAt","updatedAt")
VALUES (${q(randomUUID())}, ${q(name)}, ${q(email.toLowerCase())}, ${q(hash)}, 'ADMIN', true, NOW(), NOW());`);
