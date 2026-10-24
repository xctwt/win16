// Writes .br and .gz next to each text asset in the build so the server can
// send them precompressed (see server/static.ts). Usage: bun scripts/compress.ts [dir]
import { Glob } from "bun";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { join } from "node:path";

const dir = process.argv[2] ?? "dist/public";
let count = 0;
for await (const file of new Glob("**/*.{js,css,html,svg,json,txt}").scan(dir)) {
  const path = join(dir, file);
  const data = await Bun.file(path).bytes();
  if (data.length < 1024) continue;
  const br = brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
  const gz = gzipSync(data, { level: 9 });
  if (br.length < data.length) await Bun.write(`${path}.br`, br);
  if (gz.length < data.length) await Bun.write(`${path}.gz`, gz);
  count++;
}
console.log(`compressed ${count} files in ${dir}`);
