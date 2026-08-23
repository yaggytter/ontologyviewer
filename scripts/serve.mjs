import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT ?? 4173);
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname);
  if (pathname === "/") {
    response.writeHead(302, {
      Location: "/examples/index.html",
      "Cache-Control": "no-store",
    }).end();
    return;
  }
  const relative = pathname.replace(/^\/+/, "");
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    if (!statSync(target).isFile()) throw new Error("Not a file");
    const headers = {
      "Content-Type": mime.get(extname(target)) ?? "application/octet-stream",
      "Cache-Control": "no-store",
      ...(pathname.includes("strict-csp") ? {
        "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src data: blob:; font-src 'self'",
      } : {}),
    };
    response.writeHead(200, headers);
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`ontologyviewer examples: http://127.0.0.1:${port}/examples/index.html`);
});
