import { TesseractOcrEngine } from "../infrastructure/TesseractOcrEngine";

const path = process.argv[2];
const engine = new TesseractOcrEngine();

console.log("available:", await engine.isAvailable());

const buffer = Buffer.from(await Bun.file(path).arrayBuffer());

const started = Date.now();
const pages = await engine.recognisePages(buffer, 37, (d, t) =>
  console.log(`  page ${d}/${t} (${((Date.now() - started) / 1000).toFixed(0)}s)`),
);

const total = pages.reduce((s, p) => s + p.trim().length, 0);
console.log(`\npages returned: ${pages.length}`);
console.log(`total chars: ${total}`);
console.log(`elapsed: ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log("\n--- page 1 ---");
console.log(pages[0]?.slice(0, 400));
console.log("\n--- page 2 ---");
console.log(pages[1]?.slice(0, 400));

process.exit(0);