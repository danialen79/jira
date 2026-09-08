/**
 * SVAR ships `dist/index.cjs` but package.json points `require`/`main` at
 * `dist/index.cjs.js`. Webpack/Next resolve the require condition and fail.
 * Copy the file so both paths exist after every install.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svarRoot = path.join(root, "node_modules", "@svar-ui");

if (!fs.existsSync(svarRoot)) {
  process.exit(0);
}

let fixed = 0;
for (const name of fs.readdirSync(svarRoot)) {
  const dist = path.join(svarRoot, name, "dist");
  const cjs = path.join(dist, "index.cjs");
  const cjsJs = path.join(dist, "index.cjs.js");
  if (fs.existsSync(cjs) && !fs.existsSync(cjsJs)) {
    fs.copyFileSync(cjs, cjsJs);
    fixed += 1;
  }
}

if (fixed > 0) {
  console.log(`[fix-svar-exports] created index.cjs.js for ${fixed} package(s)`);
}
