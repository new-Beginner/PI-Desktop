import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { bootStartupEvidence, MAX_BOOT_DIAGNOSTIC_BYTES } from "./boot-diagnostics.mjs";

const ready = JSON.stringify({ level: "info", data: { output: "[agent-sidecar] ready (host-proxy mode)" } });
const configured = JSON.stringify({ level: "info", event: "agent.sidecar.configured" });
function fixture(t) {
  const root = mkdtempSync(join(process.env.PI_SCRATCH_DIR ?? tmpdir(), "boot-evidence-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (channel, name, text) => {
    mkdirSync(join(root, "logs", channel), { recursive: true });
    const path = join(root, "logs", channel, name);
    writeFileSync(path, text);
    return path;
  };
  return { root, write };
}

test("packaged startup requires real ready/configured evidence from isolated category logs", t => {
  const f = fixture(t);
  assert.equal(bootStartupEvidence("BOOT_PROBE {}", f.root).sidecarReady, false);
  f.write("agent", "runtime.log", ready);
  assert.equal(bootStartupEvidence("BOOT_PROBE {}", f.root).sidecarReady, false);
  f.write("app", "runtime.log", configured);
  const result = bootStartupEvidence("BOOT_PROBE {}", f.root);
  assert.equal(result.sidecarReady, true);
  assert.equal(result.startupClean, true);
});

test("development stdout remains valid, and errors in either transport fail startup", t => {
  const f = fixture(t);
  assert.equal(bootStartupEvidence(`${ready}\n${configured}`, f.root).sidecarReady, true);
  f.write("app", "runtime.log", configured);
  f.write("agent", "runtime.1.log", ready);
  for (const level of ["error", "fatal"]) {
    f.write("app", "diagnostics.log", JSON.stringify({ level, event: "fixture.failure" }));
    assert.equal(bootStartupEvidence("", f.root).startupClean, false);
  }
  f.write("app", "diagnostics.log", "");
  assert.equal(bootStartupEvidence("Cannot find module fixture", f.root).startupClean, false);
});

test("unrelated files and directories cannot supply readiness evidence", t => {
  const f = fixture(t);
  f.write("private", "runtime.log", `${ready}\n${configured}`);
  f.write("app", "state.json", `${ready}\n${configured}`);
  assert.equal(bootStartupEvidence("", f.root).sidecarReady, false);
  mkdirSync(join(f.root, "logs", "app", "runtime.log"));
  assert.throws(() => bootStartupEvidence("", f.root), /regular file/);
});

test("oversized diagnostic evidence fails explicitly instead of hiding errors", t => {
  const f = fixture(t);
  const path = f.write("app", "runtime.log", "");
  truncateSync(path, MAX_BOOT_DIAGNOSTIC_BYTES + 1);
  assert.throws(() => bootStartupEvidence("", f.root), /evidence budget/);
});
