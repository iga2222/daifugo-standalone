// Client bundle for the standalone deployment.
//
// Mirrors the Muse space build (Bun.build + tailwind plugin, production
// mode) but outputs to ./public at the project root, where server/index.ts
// serves it as static files.

import { readFile, rm, writeFile } from "node:fs/promises";
import tailwindPlugin from "bun-plugin-tailwind";

const OUTDIR = "./public";

await rm(OUTDIR, { force: true, recursive: true });
const result = await Bun.build({
  entrypoints: ["./client/index.html"],
  outdir: OUTDIR,
  minify: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  naming: {
    asset: "assets/[name]-[hash].[ext]",
    chunk: "assets/[name]-[hash].[ext]",
    entry: "[name].[ext]",
  },
  plugins: [tailwindPlugin],
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error("client build failed; see logged diagnostics");
}

// Repoint the apple-touch-icon <link> in the built HTML at a fixed root
// path no older icon ever used: /apple-touch-icon-v2.png. The bundler
// rewrites the source link to a hashed asset URL whose bytes are the same
// current icon, but a device (or intermediary cache) that still holds an
// older icon under a URL it has seen before can keep serving the stale
// one; a brand-new path forces a fresh fetch. server/index.ts answers
// that path with the current 180px icon. (Writing the absolute path in
// the source HTML is not an option: the bundler tries to resolve it as a
// local file and fails the build.)
const htmlPath = `${OUTDIR}/index.html`;
const html = await readFile(htmlPath, "utf8");
const patched = html.replace(
  /(<link rel="apple-touch-icon"[^>]*?href=")[^"]*(")/,
  "$1/apple-touch-icon-v2.png$2",
);
if (patched === html) {
  throw new Error("apple-touch-icon link not found in built index.html");
}
await writeFile(htmlPath, patched);

console.log(`client built -> ${OUTDIR}`);
