import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const markdown = walk(root).filter((path) => path.endsWith(".md") && !path.includes(`${join(root, "node_modules")}`) && !path.includes(`${join(root, "coverage")}`));
const errors = [];
for (const file of markdown) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1].split("#")[0];
    if (!href || /^(?:https?:|mailto:)/.test(href)) continue;
    const target = resolve(dirname(file), decodeURIComponent(href));
    if (!existsSync(target)) errors.push(`${relative(root, file)} -> ${href}`);
  }
}
for (const required of [
  "examples/basic.html", "examples/index.html", "examples/multiple-viewers.html", "examples/programmatic-api.html", "examples/raw-turtle.html", "examples/strict-csp.html",
  "docs/API.md", "docs/GETTING_STARTED.md", "docs/CUSTOMIZATION.md", "docs/TROUBLESHOOTING.md", "docs/PUBLISHING.md",
]) {
  if (!existsSync(join(root, required))) errors.push(`missing ${required}`);
}
const readme = readFileSync(join(root, "README.md"), "utf8");
for (const artifact of ["ontologyviewer.esm.min.mjs", "ontologyviewer.css"]) {
  if (!readme.includes(artifact)) errors.push(`README is missing ${artifact}`);
}
const api = readFileSync(join(root, "docs/API.md"), "utf8");
if (!api.includes("exportPng(): Promise<Blob>")) errors.push("API docs are missing the PNG Blob contract");
if (errors.length) throw new Error(`Documentation checks failed:\n${errors.join("\n")}`);
console.log(`Documentation check passed (${markdown.length} Markdown files).`);

function walk(directory) {
  const entries = readdirSync(directory);
  return entries.flatMap((name) => {
    if (["node_modules", ".git", "dist", "coverage", "playwright-report", "test-results"].includes(name)) return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
