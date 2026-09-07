/**
 * `tsc` faqat .ts fayllarni ko'chiradi. Migratsiya .sql fayllari va Mini App
 * statik fayllari ham dist/ ichida kerak — shuni shu skript bajaradi.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

copyDir(path.join(root, "src", "db", "migrations"), path.join(root, "dist", "db", "migrations"));
console.log("✅ Migratsiya fayllari dist/ ga ko'chirildi");
