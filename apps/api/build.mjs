// Bundles the API into dist/. Third-party dependencies stay external (installed in the
// runtime image); workspace packages such as @fwp/shared are bundled in.
import { build } from "esbuild";
import { readFileSync, rmSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith("@fwp/"));

rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/server.ts", "src/migrate.ts", "src/cli.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: true,
  external,
  logLevel: "info",
});
