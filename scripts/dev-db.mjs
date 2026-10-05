// PostgreSQL local para desarrollo (embedded-postgres). Datos en ./.pgdata
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";

const dataDir = "./.pgdata";
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
});

const fresh = !fs.existsSync(`${dataDir}/PG_VERSION`);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("reportes311");
console.log("PostgreSQL listo en localhost:5432 (db: reportes311)");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
