import {existsSync, readdirSync, rmSync} from "node:fs";
import {dirname, join} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const webpackCache = join(root, "node_modules", ".cache", "webpack");

if (existsSync(webpackCache)) {
  for (const entry of readdirSync(webpackCache, {withFileTypes: true})) {
    if (entry.isDirectory() && entry.name.startsWith("remotion-production-")) {
      rmSync(join(webpackCache, entry.name), {recursive: true, force: true});
    }
  }
}

const cli = join(root, "node_modules", "@remotion", "cli", "remotion-cli.js");
const nodeOptions = [process.env.NODE_OPTIONS, "--max-old-space-size=4096"]
  .filter(Boolean)
  .join(" ");

const result = spawnSync(
  process.execPath,
  [
    cli,
    "render",
    "src/remotion/index.ts",
    "MarkMatePromo",
    "out/markmate-promo.mp4",
    "--codec=h264",
    "--audio-codec=aac",
    "--concurrency=4",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {...process.env, NODE_OPTIONS: nodeOptions},
  }
);

process.exit(result.status ?? 1);
