import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
export const MAX_BOOT_DIAGNOSTIC_BYTES = 16 * 1024 * 1024;
/** Read only category logs belonging to this probe's isolated data directory. */
export function readBootDiagnostics(dataDir) {
  const root = join(dataDir, "logs");
  if (!existsSync(root)) return "";
  const requireDirectory = (path) => {
    const info = lstatSync(path);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Boot diagnostic directory must be a real directory");
  };
  requireDirectory(root);
  const parts = [];
  let bytes = 0;
  for (const channel of ["app", "host", "agent"]) {
    const directory = join(root, channel);
    if (!existsSync(directory)) continue;
    requireDirectory(directory);
    for (const name of readdirSync(directory).sort()) {
      if (!/^[a-z][a-z0-9-]*(?:\.\d+)?\.log$/i.test(name)) continue;
      const path = join(directory, name);
      const info = lstatSync(path);
      if (info.isSymbolicLink() || !info.isFile()) throw new Error("Boot diagnostic log must be a regular file");
      bytes += info.size;
      if (bytes > MAX_BOOT_DIAGNOSTIC_BYTES) throw new Error("Boot diagnostic logs exceeded the evidence budget");
      parts.push(readFileSync(path, "utf8"));
    }
  }
  return parts.join("\n");
}
export function bootStartupEvidence(stdout, dataDir) {
  const output = `${stdout}\n${readBootDiagnostics(dataDir)}`;
  return {
    output,
    sidecarReady: output.includes("[agent-sidecar] ready (host-proxy mode)") && output.includes('"event":"agent.sidecar.configured"'),
    startupClean: !/"level":"(?:error|fatal)"|App threw an error|ERR_MODULE_NOT_FOUND|Cannot find module/.test(output),
  };
}
