import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { APP_VERSION } from "../packages/shared/dist/protocol.js";
const require = createRequire(import.meta.url);
const asar = require(require.resolve("@electron/asar", { paths: [resolve("apps/desktop")] }));
const pins = JSON.parse(readFileSync(new URL("./four-pr-preview-sources.json", import.meta.url), "utf8"));
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(version, pins.version);
assert.equal(APP_VERSION, version, "Compiled runtime and package versions must match");
for (const source of Object.values(pins.sources)) execFileSync("git", ["merge-base", "--is-ancestor", source, "HEAD"]);
const directory = "apps/desktop/release";
const packaged = JSON.parse(asar.extractFile(join(directory, "win-unpacked/resources/app.asar"), "package.json"));
assert.equal(packaged.version, version);
assert.equal(packaged.piDistribution, "portable");
assert(existsSync(join(directory, "win-unpacked/resources/bin/pi-desktop-host-core.exe")));
const files = readdirSync(directory).filter(name => /\.(exe|zip)$/.test(name)).sort();
assert.equal(files.length, 3);
assert(files.some(name => name.startsWith("PI-Desktop-Setup-") && name.endsWith(".exe")));
assert(files.some(name => name.startsWith("PI-Desktop-Portable-") && name.endsWith(".exe")));
assert(files.some(name => name.endsWith(".zip")));
const checksums = files.map(name => {
  assert(name.includes(version), `Missing version in ${name}`);
  return { name, sha256: createHash("sha256").update(readFileSync(join(directory, name))).digest("hex") };
});
const provenance = { ...pins, commit: process.env.GITHUB_SHA,
  tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
  repository: process.env.GITHUB_REPOSITORY, unsigned: true, files: checksums };
writeFileSync(join(directory, "SHA256SUMS.txt"), checksums.map(item => `${item.sha256}  ${item.name}`).join("\n") + "\n");
writeFileSync(join(directory, "build-info.json"), JSON.stringify(provenance, null, 2) + "\n");
console.log(JSON.stringify(provenance, null, 2));
