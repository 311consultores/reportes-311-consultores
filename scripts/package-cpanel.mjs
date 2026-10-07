// Empaqueta la app para subirla a cPanel (Setup Node.js App).
// Uso: npm run package:cpanel   ->  genera ./dist-cpanel/{app,database}
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "dist-cpanel");

fs.rmSync(out, { recursive: true, force: true });

console.log("1/4 Generando cliente Prisma y compilando (standalone, webpack)...");
// Se usa webpack: Turbopack renombra los paquetes externos con un hash (@prisma/client-2c3a...) y los
// resuelve con enlaces simbólicos que no sobreviven al empaquetar desde Windows ni al extraer en cPanel.
execSync("npx prisma generate && npx next build --webpack", {
  stdio: "inherit",
  env: { ...process.env, BUILD_STANDALONE: "1", NODE_ENV: "production" },
});

console.log("2/4 Copiando aplicación...");
const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(path.join(standalone, "server.js"))) {
  throw new Error("No se generó .next/standalone/server.js");
}
fs.cpSync(standalone, path.join(out, "app"), { recursive: true, dereference: true });
fs.cpSync(path.join(root, ".next", "static"), path.join(out, "app", ".next", "static"), { recursive: true });
if (fs.existsSync(path.join(root, "public"))) {
  fs.cpSync(path.join(root, "public"), path.join(out, "app", "public"), { recursive: true });
}
// El .env local nunca debe viajar en el paquete
fs.rmSync(path.join(out, "app", ".env"), { force: true });

// Seguridad del paquete: no debe haber enlaces simbólicos ni paquetes externos con hash (Turbopack)
const links = [];
const hashed = [];
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) links.push(p);
    else if (e.isDirectory()) scan(p);
    else if (/\.(js|mjs|cjs)$/.test(e.name) && p.includes(path.join(".next", "server"))) {
      if (/@prisma\/client-[0-9a-f]{16}/.test(fs.readFileSync(p, "utf8"))) hashed.push(p);
    }
  }
})(path.join(out, "app"));
if (links.length) throw new Error("El paquete contiene enlaces simbólicos:\n" + links.slice(0, 5).join("\n"));
if (hashed.length) throw new Error("El build usa paquetes externos con hash (Turbopack):\n" + hashed.slice(0, 3).join("\n"));

console.log("3/4 Generando schema.sql desde las migraciones...");
const migDir = path.join(root, "prisma", "migrations");
const sql = fs
  .readdirSync(migDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((d) => `-- ${d.name}\n` + fs.readFileSync(path.join(migDir, d.name, "migration.sql"), "utf8"))
  .join("\n");
fs.mkdirSync(path.join(out, "database"), { recursive: true });
fs.writeFileSync(path.join(out, "database", "schema.sql"), sql);

console.log("4/4 Recortando motores de Prisma (el servidor cPanel es RHEL/CloudLinux)...");
const engines = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/query_engine.*\.node$/.test(e.name)) {
      if (/windows|debian/.test(e.name)) fs.rmSync(p, { force: true });
      else engines.push(e.name);
    }
  }
})(path.join(out, "app"));
console.log([...new Set(engines)].join("\n") || "(ninguno: revisa outputFileTracingIncludes)");

const size = (d) => {
  let t = 0;
  (function w(x) {
    for (const e of fs.readdirSync(x, { withFileTypes: true })) {
      const p = path.join(x, e.name);
      e.isDirectory() ? w(p) : (t += fs.statSync(p).size);
    }
  })(d);
  return (t / 1024 / 1024).toFixed(1);
};
console.log(`\nListo: dist-cpanel/app (${size(path.join(out, "app"))} MB) y dist-cpanel/database/schema.sql`);
