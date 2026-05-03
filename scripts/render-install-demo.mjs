import {mkdirSync} from "node:fs";
import {dirname, join} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(root, "public", "remotion-assets");
mkdirSync(outputDir, {recursive: true});

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
    "MarkMateInstallDemo",
    "public/remotion-assets/markmate-install-demo.mp4",
    "--codec=h264",
    "--concurrency=2",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {...process.env, NODE_OPTIONS: nodeOptions},
  }
);

process.exit(result.status ?? 1);
