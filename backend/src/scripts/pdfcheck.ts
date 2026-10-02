import { PDFParse } from "pdf-parse";

const path = process.argv[2];

const parser = new PDFParse({ data: new Uint8Array(await Bun.file(path).arrayBuffer()) });

try {
  const result = await parser.getText();
  console.log("OK pages:", result.pages?.length ?? result.total);
  console.log("text length:", result.text?.length ?? 0);
  console.log("first 200:", JSON.stringify((result.text ?? "").slice(0, 200)));
} catch (e: any) {
  console.log("FAILED:", e?.name, "-", e?.message);
  console.log("stack:", e?.stack?.split("\n").slice(0, 4).join("\n"));
} finally {
  await parser.destroy();
}

process.exit(0);