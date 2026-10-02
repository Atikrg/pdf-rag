import type { IOcrEngine } from "../core/ports/IOcrEngine";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";

const execFileAsync = promisify(execFile);

/** Poppler rasterises at this DPI: 300 is the usual floor for reliable OCR. */
const RENDER_DPI = 300;

/** Guards against a decompression bomb or a mis-parsed page count. */
const MAX_OCR_PAGES = 500;

/** tesseract writes progress to stderr; keep only lines that parse as such. */
const TIMEOUT_PER_PAGE_MS = 120_000;

export class TesseractOcrEngine implements IOcrEngine {
  constructor(
    private readonly renderCommand = "pdftoppm",
    private readonly ocrCommand = "tesseract",
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync(this.renderCommand, ["-v"]);
      await execFileAsync(this.ocrCommand, ["--version"]);
      return true;
    } catch {
      return false;
    }
  }

  async recognisePages(
    pdfBuffer: Buffer,
    totalPages: number,
    onPageDone?: (done: number, total: number) => void,
  ): Promise<string[]> {
    const total = Math.min(totalPages, MAX_OCR_PAGES);
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-"));
    const pdfPath = path.join(workDir, "input.pdf");

    try {
      await fs.writeFile(pdfPath, pdfBuffer);

      // Rasterise the whole document in one pass. Doing it per page would
      // re-parse the PDF 37 times for a 37-page scan.
      await execFileAsync(
        this.renderCommand,
        [
          "-r",
          String(RENDER_DPI),
          "-png",
          pdfPath,
          path.join(workDir, "page"),
        ],
        { maxBuffer: 32 * 1024 * 1024 },
      );

      const rendered = (await fs.readdir(workDir))
        .filter((f) => /^page-\d+\.png$/.test(f))
        // pdftoppm zero-pads to the width of the page count, so plain string
        // order would put page 10 before page 2.
        .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

      const pages: string[] = [];

      for (const [index, image] of rendered.entries()) {
        pages.push(await this.recogniseImage(path.join(workDir, image)));
        onPageDone?.(index + 1, rendered.length);
      }

      // Pad so the result is always `total` long: a caller indexing by page
      // number must not get `undefined` for a page that failed to render.
      while (pages.length < total) pages.push("");

      return pages;
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async recogniseImage(imagePath: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        this.ocrCommand,
        [imagePath, "stdout", "--psm", "3"],
        {
          timeout: TIMEOUT_PER_PAGE_MS,
          maxBuffer: 16 * 1024 * 1024,
        },
      );

      // Normalise the blank space that page furniture introduces, so an
      // all-blank page collapses to "" instead of looking like content.
      return stdout.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    } catch {
      // One unreadable page must not fail the document; the rest still index.
      return "";
    }
  }
}