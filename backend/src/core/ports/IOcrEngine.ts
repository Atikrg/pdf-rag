/**
 * Recognises text in pages that carry no extractable text layer — scanned or
 * photographed documents.
 *
 * Kept as a port so the pipeline depends on the capability rather than on a
 * particular engine. Swapping Tesseract for a cloud OCR provider is an
 * infrastructure change, not a pipeline change.
 */
export interface IOcrEngine {
  /**
   * True when the environment can actually perform OCR. False means "not
   * installed", not "failed", so callers can degrade to a clear error instead
   * of throwing mid-upload.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Extracts text per page. `pages` is 1-based and must be returned in the
   * same length and order as the input, with an empty string for any page that
   * yielded nothing, so callers can keep page numbers aligned with the source
   * document for citation.
   */
  recognisePages(
    pdfBuffer: Buffer,
    totalPages: number,
    onPageDone?: (done: number, total: number) => void,
  ): Promise<string[]>;
}