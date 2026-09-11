import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const command = (name) => process.platform === "win32" ? `${name}.exe` : name;
const checks = [];

function probe(name, args = ["-version"]) {
  try {
    const first = execFileSync(command(name), args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      .trim().split(/\r?\n/)[0];
    checks.push({ name, ok: true, detail: first });
  } catch {
    checks.push({ name, ok: false, detail: "not found on PATH" });
  }
}

probe("node", ["--version"]);
probe("ffmpeg");
probe("ffprobe");

let hyperframes = false;
try {
  const pkg = JSON.parse(await readFile(new URL("./node_modules/hyperframes/package.json", import.meta.url), "utf8"));
  hyperframes = pkg.version;
} catch { /* optional dependency is absent */ }
checks.push({ name: "hyperframes", ok: Boolean(hyperframes), detail: hyperframes ? `v${hyperframes}` : "not installed" });

for (const check of checks) console.log(`${check.ok ? "✓" : "✗"} ${check.name}: ${check.detail}`);

const required = checks.filter((c) => c.name === "node" && !c.ok);
const video = checks.filter((c) => ["ffmpeg", "ffprobe", "hyperframes"].includes(c.name) && !c.ok);
if (video.length) {
  console.log("\nPNG and carousel export can still work. Video export needs every missing video dependency above.");
  console.log("See README.md → Video export setup.");
}
if (required.length) process.exitCode = 1;
