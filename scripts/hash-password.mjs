// Genera SQL para crear o restablecer un administrador sin ejecutar el seed en el servidor.
//
// Crear:        node scripts/hash-password.mjs "correo@dominio.com" "Nombre" "Contraseña-de-12+-caracteres"
// Restablecer:  node scripts/hash-password.mjs --reset "correo@dominio.com" "Contraseña-de-12+-caracteres"
//
// En PowerShell escribe la contraseña entre comillas SIMPLES ('...'): con comillas dobles, un "$" se
// interpreta como variable y la contraseña guardada no sería la que escribiste.
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const reset = args[0] === "--reset";
if (reset) args.shift();

const [email, second, third] = args;
const name = reset ? undefined : second;
const password = reset ? second : third;

if (!email || !password || (!reset && !name) || password.length < 12) {
  console.error("Uso para crear:       node scripts/hash-password.mjs 'correo' 'Nombre' 'Contraseña (mín. 12 caracteres)'");
  console.error("Uso para restablecer: node scripts/hash-password.mjs --reset 'correo' 'Contraseña (mín. 12 caracteres)'");
  process.exit(1);
}

const q = (s) => `'${s.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
const bt = "`";
const hash = await bcrypt.hash(password, 12);
const mail = email.trim().toLowerCase();

if (reset) {
  console.log(
    `UPDATE ${bt}User${bt} SET ${bt}passwordHash${bt} = ${q(hash)}, ${bt}active${bt} = true, ${bt}updatedAt${bt} = NOW(3) ` +
      `WHERE ${bt}email${bt} = ${q(mail)};`,
  );
} else {
  const cols = ["id", "name", "email", "passwordHash", "role", "active", "createdAt", "updatedAt"].map((c) => bt + c + bt).join(", ");
  const vals = [q(randomUUID()), q(name), q(mail), q(hash), "'ADMIN'", "true", "NOW(3)", "NOW(3)"].join(", ");
  console.log(`INSERT INTO ${bt}User${bt} (${cols})\nVALUES (${vals});`);
}
