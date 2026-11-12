// Client bundle for the standalone deployment.
//
// Mirrors the Muse space build (Bun.build + tailwind plugin, production
// mode) but outputs to ./public at the project root, where server/index.ts
// serves it as static files.

import { rm } from "node:fs/promises";
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
console.log(`client built -> ${OUTDIR}`);
