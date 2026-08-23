import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "ontologyviewer-pack-"));
const consumer = join(work, "consumer");
const maxGzipBytes = 600 * 1024;

try {
  const packJson = execFileSync("npm", ["pack", "--json", "--pack-destination", work], { cwd: root, encoding: "utf8" });
  const [packed] = JSON.parse(packJson);
  if (!packed?.filename || !Array.isArray(packed.files)) throw new Error("npm pack did not return its file manifest.");
  const tarball = join(work, packed.filename);

  const required = [
    "dist/ontologyviewer.esm.mjs",
    "dist/ontologyviewer.esm.min.mjs",
    "dist/ontologyviewer.css",
    "dist/index.d.ts",
    "README.md",
    "README.ja.md",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
  ];
  const names = new Set(packed.files.map((entry) => entry.path));
  for (const name of required) {
    if (!names.has(name)) throw new Error(`Missing packed file: ${name}`);
  }
  for (const name of names) {
    if (!(name.startsWith("dist/") || required.includes(name) || name === "package.json")) {
      throw new Error(`Unexpected packed file: ${name}`);
    }
  }

  const minified = readFileSync(join(root, "dist/ontologyviewer.esm.min.mjs"));
  const gzipBytes = gzipSync(minified).byteLength;
  if (gzipBytes > maxGzipBytes) {
    throw new Error(`Minified ESM is ${(gzipBytes / 1024).toFixed(1)} KiB gzip; limit is 600 KiB.`);
  }

  mkdirSync(consumer, { recursive: true });
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "ontologyviewer-consumer", private: true, type: "module" }, null, 2));
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", tarball], { cwd: consumer, stdio: "pipe" });
  writeFileSync(join(consumer, "smoke.mjs"), `
import ontologyviewer, { initialize, render, getInstance } from "ontologyviewer";
if (ontologyviewer.initialize !== initialize) throw new Error("default export mismatch");
for (const value of [initialize, render, getInstance]) if (typeof value !== "function") throw new Error("missing named export");
`);
  execFileSync(process.execPath, [join(consumer, "smoke.mjs")], { cwd: consumer, stdio: "inherit" });

  writeFileSync(join(consumer, "types.ts"), `
import ontologyviewer, { type OntologyViewerInstance } from "ontologyviewer";
declare const element: HTMLElement;
const instance: OntologyViewerInstance = ontologyviewer.render(element, { baseIri: "https://example.org/", theme: "auto" });
void instance.update("@prefix : <https://example.org/> .");
void instance.exportPng().then((blob: Blob) => blob.size);
`);
  writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({ compilerOptions: {
    strict: true, noEmit: true, target: "ES2020", module: "ES2020", moduleResolution: "bundler", lib: ["ES2020", "DOM"], skipLibCheck: true,
  }, include: ["types.ts"] }, null, 2));
  const tsc = join(root, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
  if (!existsSync(tsc)) throw new Error("TypeScript executable is missing.");
  execFileSync(tsc, ["-p", join(consumer, "tsconfig.json")], { cwd: consumer, stdio: "inherit" });

  console.log(`Tarball consumer check passed (${packed.files.length} files, ${(gzipBytes / 1024).toFixed(1)} KiB gzip).`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
