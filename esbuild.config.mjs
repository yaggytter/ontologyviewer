import * as esbuild from "esbuild";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
const css = readFileSync(join(root, "src/styles/ontologyviewer.css"), "utf8");
const shared = {
  entryPoints: [join(root, "src/index.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  legalComments: "external",
  define: { __ONTOLOGY_VIEWER_CSS__: JSON.stringify(css) },
};

await esbuild.build({
  ...shared,
  outfile: join(dist, "ontologyviewer.esm.mjs"),
  sourcemap: true,
});
const minified = await esbuild.build({
  ...shared,
  outfile: join(dist, "ontologyviewer.esm.min.mjs"),
  sourcemap: true,
  minify: true,
  metafile: true,
});
writeFileSync(join(dist, "meta.json"), JSON.stringify(minified.metafile, null, 2));
writeFileSync(join(dist, "ontologyviewer.css"), css);
console.log("Built ontologyviewer ESM, minified ESM, CSS, and metadata.");
