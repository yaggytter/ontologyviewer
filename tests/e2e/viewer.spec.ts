import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/e2e/harness.html");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
});

test("auto-initializes multiple isolated viewers with themes and locales", async ({ page }) => {
  const roots = page.locator(".ontologyviewer-root");
  await expect(roots).toHaveCount(2);
  await expect(page.locator("#first")).toBeHidden();
  await expect(page.locator("#second")).toBeHidden();
  await expect(roots.nth(0)).toHaveAttribute("data-theme", "light");
  await expect(roots.nth(1)).toHaveAttribute("data-theme", "dark");
  await expect(roots.nth(0).locator("canvas")).toHaveCount(3);
  await expect(roots.nth(0).locator(".ov-stats")).toContainText("Entities: 2");
  await expect(roots.nth(1).locator(".ov-stats")).toContainText("エンティティ: 1");
});

test("searches, inspects, switches views, and changes layout", async ({ page }) => {
  const root = page.locator(".ontologyviewer-root").first();
  await root.locator(".ov-search").fill("Product");
  const result = root.locator(".ov-search-item").first();
  await expect(result).toContainText("Product");
  await result.click();
  await expect(root.locator(".ov-inspector")).toContainText("Product");
  await expect(root.locator(".ov-inspector input")).toHaveCount(0);

  await root.locator(".ov-btn-triples").click();
  await expect(root.locator(".ov-btn-triples")).toHaveAttribute("aria-pressed", "true");
  await root.locator(".ov-layout-select").selectOption("dagre");
  await expect(root.locator(".ov-layout-select")).toHaveValue("dagre");
  await expect(root.locator("canvas")).toHaveCount(3);
});

test("shows a safe parse error and recovers on a valid update", async ({ page }) => {
  await page.evaluate(async () => {
    await (window as unknown as { harness: { invalid(): Promise<void> } }).harness.invalid();
  });
  const firstRoot = page.locator(".ontologyviewer-root").first();
  await expect(firstRoot.locator("[role=alert]")).toContainText("Parse error");
  await expect(firstRoot.locator("script")).toHaveCount(0);

  await page.evaluate(async () => {
    await (window as unknown as { harness: { valid(): Promise<void> } }).harness.valid();
  });
  await expect(firstRoot.locator("[role=alert]")).toHaveCount(0);
  await expect(firstRoot.locator(".ov-stats")).toContainText("Entities: 1");
  await expect(firstRoot.locator("canvas")).toHaveCount(3);
});

test("does not observe dynamic DOM and restores source on destroy", async ({ page }) => {
  await page.evaluate(() => {
    (window as unknown as { harness: { addDynamic(): void } }).harness.addDynamic();
  });
  await expect(page.locator(".ontologyviewer-root")).toHaveCount(2);
  await expect(page.locator("#dynamic")).toBeVisible();

  const scanned = await page.evaluate(() => (
    window as unknown as { harness: { scan(): number } }
  ).harness.scan());
  expect(scanned).toBe(3);
  await expect(page.locator(".ontologyviewer-root")).toHaveCount(3);

  await page.evaluate(() => {
    (window as unknown as { harness: { destroyFirst(): void } }).harness.destroyFirst();
  });
  await expect(page.locator("#first")).toBeVisible();
  await expect(page.locator(".ontologyviewer-root")).toHaveCount(2);
});

test("exports a non-empty PNG Blob", async ({ page }) => {
  const size = await page.evaluate(async () => (
    window as unknown as { harness: { pngSize(): Promise<number> } }
  ).harness.pngSize());
  expect(size).toBeGreaterThan(100);
});

test("works with an external stylesheet under strict CSP", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") violations.push(message.text());
  });
  await page.goto("/tests/e2e/strict-csp.html");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  const root = page.locator(".ontologyviewer-root");
  await expect(root).toBeVisible();
  await expect(root.locator("canvas")).toHaveCount(3);
  expect(violations.filter((message) => message.includes("Content Security Policy"))).toEqual([]);
});


test("has no serious or critical automated accessibility violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).include(".ontologyviewer-root").analyze();
  const severe = results.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => node.target) }));
  expect(severe).toEqual([]);
});


test("example index hides bootstrap guidance after successful HTTP startup", async ({ page }) => {
  await page.goto("/examples/index.html");
  await expect(page.locator("html")).toHaveAttribute("data-example-ready", "true");
  await expect(page.locator("[data-example-status]")).toBeHidden();
  await expect(page.locator(".ontologyviewer-root")).toHaveCount(1);
});

test("example index paints a visible graph", async ({ page }) => {
  await page.goto("/examples/index.html");
  await expect(page.locator("html")).toHaveAttribute("data-example-ready", "true");

  const graphBox = await page.locator(".ov-graph").boundingBox();
  expect(graphBox?.height).toBeGreaterThan(200);
  const visiblePixels = await page.locator(".ov-graph canvas").evaluateAll((canvases) => canvases.reduce((total, canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) return total;
    const context = canvas.getContext("2d");
    if (!context || canvas.width === 0 || canvas.height === 0) return total;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      const isNonWhite = pixels[index - 3] < 245 || pixels[index - 2] < 245 || pixels[index - 1] < 245;
      if (pixels[index] !== 0 && isNonWhite) visible += 1;
    }
    return total + visible;
  }, 0));
  expect(visiblePixels).toBeGreaterThan(100);
});

test("example index links to every demo", async ({ page }) => {
  await page.goto("/examples/index.html");
  const links = page.locator("[data-example-links] a");

  await expect(links).toHaveCount(5);
  expect(await links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")))).toEqual([
    "./basic.html",
    "./multiple-viewers.html",
    "./programmatic-api.html",
    "./strict-csp.html",
    "./raw-turtle.html",
  ]);
});

test("schema labels remain inside their cards", async ({ page }) => {
  await page.goto("/examples/index.html");
  await expect(page.locator("html")).toHaveAttribute("data-example-ready", "true");

  const overflow = await page.locator(".ov-graph").evaluate((graph) => {
    const cy = Reflect.get(graph, "_cyreg").cy;
    return cy.nodes().map((node: { renderedBoundingBox(options: Record<string, boolean>): { x1: number; x2: number; y1: number; y2: number } }) => {
      const body = node.renderedBoundingBox({ includeLabels: false, includeOverlays: false, includeUnderlays: false });
      const withLabel = node.renderedBoundingBox({ includeLabels: true, includeOverlays: false, includeUnderlays: false });
      return Math.max(body.x1 - withLabel.x1, withLabel.x2 - body.x2, body.y1 - withLabel.y1, withLabel.y2 - body.y2);
    });
  });

  expect(Math.max(...overflow)).toBeLessThanOrEqual(1);
});

test("triples view represents metadata triples and distinguishes literals", async ({ page }) => {
  await page.goto("/examples/index.html");
  await page.locator(".ov-btn-triples").click();
  await expect(page.locator(".ov-btn-triples")).toHaveAttribute("aria-pressed", "true");

  const graph = await page.locator(".ov-graph").evaluate((element) => {
    const cy = Reflect.get(element, "_cyreg").cy;
    return {
      edgeLabels: cy.edges().map((edge: { data(name: string): string }) => edge.data("edgeLabel")),
      nodes: cy.nodes().map((node: { data(name: string): string }) => ({
        kind: node.data("kind"),
        label: node.data("label"),
      })),
    };
  });

  expect(graph.edgeLabels).toEqual(expect.arrayContaining(["rdf:type", "rdfs:label", "rdfs:comment"]));
  expect(graph.nodes).toContainEqual({ kind: "literal", label: "\"⛺\"" });
  expect(graph.nodes.some((node: { label: string }) => node.label === "⛺")).toBe(false);
});

test("raw Turtle script example accepts unescaped angle brackets", async ({ page }) => {
  await page.goto("/examples/raw-turtle.html");
  await expect(page.locator("html")).toHaveAttribute("data-example-ready", "true");
  await expect(page.locator(".ontologyviewer-root")).toHaveCount(1);
  const source = page.locator('script[type="text/turtle"].ontologyviewer');
  await expect(source).toHaveCount(1);
  expect(await source.textContent()).toContain("<http://example.org/vehicles#>");
});

test("example server root redirects to a working index", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/examples\/index\.html$/);
  await expect(page.locator("html")).toHaveAttribute("data-example-ready", "true");
  await expect(page.locator("[data-example-status]")).toBeHidden();
  await expect(page.locator(".ontologyviewer-root")).toHaveCount(1);
});

test("example index shows actionable guidance when dist cannot load", async ({ page }) => {
  await page.route("**/dist/ontologyviewer.esm.mjs", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.goto("/examples/index.html");
  const status = page.locator("[data-example-status]");
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute("role", "alert");
  await expect(status).toContainText("npm run examples");
  await expect(page.locator(".ontologyviewer-root")).toHaveCount(0);
});

test("file-direct example keeps visible HTTP-server guidance", async ({ page }) => {
  const fileUrl = new URL("../../examples/index.html", import.meta.url).href;
  await page.goto(fileUrl);
  const status = page.locator("[data-example-status]");
  await expect(status).toBeVisible();
  await expect(status).toContainText("npm run examples");
  await expect(page.locator(".ontologyviewer-root")).toHaveCount(0);
});
