// @qvac/rag 0.9.0 does not import on Node.js: its "imports" map points the
// "node" condition at "node:crypto", "node:fs" and "node:path", and Node rejects
// URL-shaped targets there (ERR_INVALID_PACKAGE_TARGET). This applies the
// proposed fix, the bare builtin names, to the installed copy so the tests can run.
import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../node_modules/@qvac/rag/package.json', import.meta.url)
const pkg = JSON.parse(readFileSync(path, 'utf8'))
for (const [name, targets] of Object.entries(pkg.imports ?? {})) {
  if (typeof targets.node === 'string' && targets.node.startsWith('node:')) {
    console.log(`${name}: "${targets.node}" -> "${targets.node.slice(5)}"`)
    targets.node = targets.node.slice(5)
  }
}
writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n')
