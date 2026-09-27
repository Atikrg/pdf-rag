import * as XLSX from "xlsx";

export interface SpreadsheetChunk {
  pageContent: string;
  metadata: {
    type: "chunk";
    documentId?: string;
    sheetName?: string;
    rowIndex?: number;
  };
}

/**
 * Parses Excel (.xlsx/.xls) and CSV buffers into per-row text chunks. Each row
 * is labelled with its sheet and, when available, its column headers so the
 * resulting text reads naturally ("Column A: value, Column B: value").
 */
export async function extractSpreadsheetChunks(
  buffer: Buffer,
  documentId?: string,
): Promise<{ chunks: SpreadsheetChunk[]; sheetCount: number }> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames;

  const chunks: SpreadsheetChunk[] = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    // Treat the first row as headers when every cell is a string and the sheet
    // appears tabular (more than one column makes header labelling meaningful).
    const firstRow = rows[0];
    const headers: string[] | null =
      firstRow &&
      Object.keys(firstRow).length > 1 &&
      Object.values(firstRow).every((v) => typeof v === "string")
        ? Object.keys(firstRow)
        : null;

    rows.forEach((row, index) => {
      const rowNumber = index + 2; // row 1 was headers (or 1-indexed data)
      const parts = headers
        ? headers
            .map((header) => {
              const value = row[header];
              return value === "" || value == null
                ? null
                : `${header}: ${String(value)}`;
            })
            .filter(Boolean)
        : Object.values(row)
            .filter((v) => v !== "" && v != null)
            .map(String);

      if (parts.length === 0) return;

      chunks.push({
        pageContent: `Sheet "${sheetName}" | Row ${rowNumber}: ${parts.join(", ")}`,
        metadata: {
          type: "chunk",
          documentId,
          sheetName,
          rowIndex: rowNumber,
        },
      });
    });
  }

  return { chunks, sheetCount: sheetNames.length };
}
