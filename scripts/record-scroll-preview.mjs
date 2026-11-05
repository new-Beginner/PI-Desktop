import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
const require = createRequire(import.meta.url);
const asar = require(require.resolve("@electron/asar", { paths: [resolve("apps/desktop")] }));
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const directory = "apps/desktop/release";
const packaged = JSON.parse(asar.extractFile(join(directory, "win-unpacked/resources/app.asar"), "package.json"));
assert.equal(packaged.version, version);assert.equal(packaged.piDistribution, "portable");
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
const provenance = {
  version, commit: process.env.GITHUB_SHA, repository: process.env.GITHUB_REPOSITORY,
  pullRequests: [1999, 2122], alreadyMerged: [2122],
  baseCandidate: "b4430db052e85c4535ad8c919f9e3f7933b015dc",
  sourceBranch: "fix/transcript-scroll-stability",
  sources: {
    main: "b4430db052e85c4535ad8c919f9e3f7933b015dc",
    scrollStability: "11fa50d372adb845f37b32a5a8fdd2abb187532b",
    pr1999: "6ae2428dd2f039bd30109a2a1817e4a33853d84b",
    pr2122: "5595f433f54d894f7062e2e2bf9a8a5575ca480e",
  },
  mergeCommits: { pr2122: "f56df5e27b51dfd9119bc4a670c8d0e377e727f6" },
  unsigned: true, files: checksums,
};
writeFileSync(join(directory, "SHA256SUMS.txt"), checksums.map(item => `${item.sha256}  ${item.name}`).join("\n") + "\n");
writeFileSync(join(directory, "build-info.json"), JSON.stringify(provenance, null, 2) + "\n");
console.log(JSON.stringify(provenance, null, 2));
