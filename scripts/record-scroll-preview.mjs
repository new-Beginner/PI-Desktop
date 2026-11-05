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
const provenance = {
  version, commit: process.env.GITHUB_SHA, repository: process.env.GITHUB_REPOSITORY,
  pullRequests: [1999, 2017], alreadyMerged: [2017],
  baseCandidate: "983f8402606f0bd92ee6f4576f4cbbc652feb288",
  sourceBranch: "fix/transcript-scroll-stability",
  sources: {
    main: "983f8402606f0bd92ee6f4576f4cbbc652feb288",
    scrollStability: "9eb23cb2b7e38ab53f73d285157d0baa6fabe81b",
    pr1999: "f3400601c05e55811fe0816e5db850ab7a2ae53a",
    pr2017: "05582704b09306df58e8ef6a7ed577a1fb5f1370",
  },
  mergeCommits: { pr2017: "e551953357b6dc633ba64184736e297126445c5a" },
  unsigned: true, files: checksums,
};
writeFileSync(join(directory, "SHA256SUMS.txt"), checksums.map(item => `${item.sha256}  ${item.name}`).join("\n") + "\n");
writeFileSync(join(directory, "build-info.json"), JSON.stringify(provenance, null, 2) + "\n");
console.log(JSON.stringify(provenance, null, 2));
