"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { getToken } from "@/lib/api";
import type { Conversation, DocRecord } from "../types";
import Icon from "../Icon";
import styles from "../chat-workspace.module.css";

const THUMBNAIL_LIMIT = 6;
const THUMB_WIDTH = 230;

let pdfWorker: Worker | null = null;

function ensurePdfWorker() {
  if (!pdfWorker && typeof window !== "undefined") {
    pdfWorker = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
    pdfjsLib.GlobalWorkerOptions.workerPort = pdfWorker;
  }
}

type LoadState = "idle" | "loading" | "ready" | "error";

function usePdfDocument(documentId: string | null): {
  pdf: PDFDocumentProxy | null;
  state: LoadState;
} {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [state, setState] = useState<LoadState>(documentId ? "loading" : "idle");

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;

    (async () => {
      if (!documentId) {
        setPdf(null);
        setState("idle");
        return;
      }

      setState("loading");
      setPdf(null);

      try {
        const token = getToken();
        const res = await fetch(`/api/documents/${documentId}/file`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);

        ensurePdfWorker();
        const data = await res.arrayBuffer();
        const doc = await pdfjsLib
          .getDocument({ data: new Uint8Array(data) })
          .promise;

        if (cancelled) {
          doc.destroy();
          return;
        }

        loaded = doc;
        setPdf(doc);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [documentId]);

  return { pdf, state };
}

type PageThumbProps = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  cited: boolean;
};

function PageThumb({ pdf, pageNumber, cited }: PageThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({
          scale: (THUMB_WIDTH * dpr) / base.width,
        });

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || cancelled) {
          page.cleanup();
          return;
        }

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();
      } catch {
        /* non-fatal: leave the placeholder if rendering fails */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber]);

  return (
    <div className={`${styles.pageThumb} ${cited ? styles.pageThumbCited : ""}`}>
      <div className={styles.ptHead}>
        <span className={styles.ptPnum}>Page {pageNumber}</span>
        {cited && <span className={styles.ptBadge}>Cited</span>}
      </div>
      <div className={styles.pageCanvasWrap}>
        <canvas ref={canvasRef} className={styles.pageCanvas} />
      </div>
    </div>
  );
}

type Props = {
  conversation: Conversation | null;
  document: DocRecord | null;
};

export default function DocumentTab({ conversation, document }: Props) {
  const citedPages = new Set(
    (conversation?.cites ?? [])
      .map((c) => /^Page (\d+)$/.exec(c.label)?.[1])
      .filter((n): n is string => Boolean(n))
      .map(Number),
  );
  const thumbCount = Math.min(document?.pages ?? 0, THUMBNAIL_LIMIT);
  const thumbs = Array.from({ length: thumbCount }, (_, i) => i + 1);
  const sizeLine = document
    ? `${document.pages} pages · ${document.chunks} chunks · Indexed`
    : "No document loaded";

  const { pdf, state } = usePdfDocument(document?.id ?? null);

  const renderPreviews = () => {
    if (!document) {
      return (
        <div className={styles.citesHint}>
          Upload a PDF to see page previews here.
        </div>
      );
    }

    if (thumbs.length === 0) {
      return (
        <div className={styles.citesHint}>
          No page previews available for this file type.
        </div>
      );
    }

    // Fall back to the placeholder skeleton while loading / for files that
    // aren't renderable PDFs (Excel, Word, plain text, etc.).
    const showReal =
      state === "ready" && pdf && pdf.numPages > 0;

    return thumbs.map((p) =>
      showReal && p <= pdf.numPages ? (
        <PageThumb
          key={p}
          pdf={pdf}
          pageNumber={p}
          cited={citedPages.has(p)}
        />
      ) : (
        <div
          key={p}
          className={`${styles.pageThumb} ${citedPages.has(p) ? styles.pageThumbCited : ""}`}
        >
          <div className={styles.ptHead}>
            <span className={styles.ptPnum}>Page {p}</span>
            {citedPages.has(p) && <span className={styles.ptBadge}>Cited</span>}
          </div>
          <div className={styles.ptLines}>
            <div className={`${styles.ptl} ${styles.ptlH}`} />
            <div className={`${styles.ptl} ${styles.ptlM}`} />
            <div className={`${styles.ptl} ${styles.ptlS}`} />
            {p % 2 === 0 ? (
              <div className={`${styles.ptl} ${styles.ptlXs}`} />
            ) : (
              <div className={`${styles.ptl} ${styles.ptlM}`} />
            )}
          </div>
        </div>
      ),
    );
  };

  return (
    <div className={styles.rpanel}>
      <div className={styles.docInfoCard}>
        <div className={styles.dicHead}>
          <div className={styles.dicIco}>
            <Icon name="pdf" size={18} />
          </div>
          <div className={styles.dicMeta}>
            <div className={styles.dicFn}>
              {document ? document.name : "No document"}
            </div>
            <div className={styles.dicSz}>{sizeLine}</div>
          </div>
        </div>
        <div className={styles.dicStats}>
          <div className={styles.dstat}>
            <div className={styles.dstatN}>
              {document ? document.pages : "–"}
            </div>
            <div className={styles.dstatL}>Total pages</div>
          </div>
          <div className={styles.dstat}>
            <div className={styles.dstatN}>
              <span>{conversation?.qcount ?? 0}</span>
            </div>
            <div className={styles.dstatL}>Questions asked</div>
          </div>
          <div className={styles.dstat}>
            <div className={styles.dstatN}>
              <span>{conversation?.cites.length ?? 0}</span>
            </div>
            <div className={styles.dstatL}>Pages cited</div>
          </div>
          <div className={styles.dstat}>
            <div
              className={styles.dstatN}
              style={{ fontSize: "0.8rem", color: "#22c55e" }}
            >
              ●&thinsp;Live
            </div>
            <div className={styles.dstatL}>AI status</div>
          </div>
        </div>
      </div>

      <div className={styles.pageLabel}>Page previews</div>
      {renderPreviews()}
    </div>
  );
}