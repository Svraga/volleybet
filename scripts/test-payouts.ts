// Runs the production scoring regressions in memory, without opening a database.
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

const result = spawnSync(process.execPath, ["--test", resolve("tests/security.test.cjs")], { stdio: "inherit" })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
