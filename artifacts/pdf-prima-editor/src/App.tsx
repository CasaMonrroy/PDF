import { useState, useRef, useCallback } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import JSZip from "jszip";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

type DetectedPrice = {
  id: string;
  pageIndex: number;
  originalText: string;
  newText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
};

type PdfStatus =
  | { kind: "loading" }
  | { kind: "needs-password" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

type PdfEntry = {
  id: string;
  file: File;
  bytes: ArrayBuffer;
  password: string;
  status: PdfStatus;
  prices: DetectedPrice[];
};

const PRICE_REGEX =
  /\$?\s?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\$?\s?\d{3,}(?:[.,]\d{1,2})?/;

function isPriceLike(s: string) {
  const trimmed = s.trim();
  if (!trimmed) return false;
  if (!/\d/.test(trimmed)) return false;
  if (/[a-zA-Z]{3,}/.test(trimmed)) return false;
  return PRICE_REGEX.test(trimmed);
}

async function loadPdfDocument(
  bytes: ArrayBuffer,
  password: string | undefined,
): Promise<PDFDocument> {
  return await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    ...(password ? { password } : {}),
  } as Parameters<typeof PDFDocument.load>[1]);
}

type PosItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Row = {
  y: number;
  height: number;
  items: PosItem[];
  text: string;
};

function groupIntoRows(items: PosItem[]): Row[] {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows: Row[] = [];
  for (const it of sorted) {
    const tol = Math.max(it.height * 0.5, 2);
    let row = rows.find((r) => Math.abs(r.y - it.y) <= tol);
    if (!row) {
      row = { y: it.y, height: it.height, items: [], text: "" };
      rows.push(row);
    }
    row.items.push(it);
    row.height = Math.max(row.height, it.height);
  }
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    row.text = row.items
      .map((i) => i.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return rows;
}

async function detectPrices(
  bytes: ArrayBuffer,
  password: string | undefined,
): Promise<DetectedPrice[]> {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes.slice(0)),
    password,
  });
  const pdf = await loadingTask.promise;
  const detected: DetectedPrice[] = [];

  for (let p = 0; p < pdf.numPages; p++) {
    const page = await pdf.getPage(p + 1);
    const content = await page.getTextContent();
    const items = content.items as Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
    }>;

    const positioned: PosItem[] = items
      .filter((it) => typeof it.str === "string" && it.str.trim().length > 0)
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width || 0,
        height: it.height || Math.abs(it.transform[3]) || 10,
      }));

    const rows = groupIntoRows(positioned);
    rows.sort((a, b) => b.y - a.y);

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!/PRIMA/i.test(row.text)) continue;

      const primaItem = row.items.find((it) => /PRIMA/i.test(it.str));
      if (!primaItem) continue;
      const primaCenterX = primaItem.x + primaItem.width / 2;

      const maxRowsBelow = 6;
      const maxVerticalDistance = row.height * 12;

      let foundForThisPrima = false;

      const besideCandidates = row.items.filter((it) => {
        if (it === primaItem) return false;
        if (!isPriceLike(it.str)) return false;
        if (it.x < primaItem.x + primaItem.width - 1) return false;
        const horizontalGap = it.x - (primaItem.x + primaItem.width);
        return horizontalGap <= primaItem.height * 20;
      });

      if (besideCandidates.length > 0) {
        besideCandidates.sort((a, b) => a.x - b.x);
        const beside = besideCandidates[0];
        const id = `p${p}-${beside.x.toFixed(2)}-${beside.y.toFixed(2)}-${beside.str}`;
        if (!detected.some((d) => d.id === id)) {
          detected.push({
            id,
            pageIndex: p,
            originalText: beside.str,
            newText: beside.str,
            x: beside.x,
            y: beside.y,
            width: beside.width,
            height: beside.height,
            fontSize: beside.height,
          });
        }
        foundForThisPrima = true;
      }

      for (
        let k = r + 1;
        !foundForThisPrima && k < rows.length && k <= r + maxRowsBelow;
        k++
      ) {
        const below = rows[k];
        if (row.y - below.y > maxVerticalDistance) break;

        const aligned = below.items.filter((it) => {
          if (!isPriceLike(it.str)) return false;
          const centerX = it.x + it.width / 2;
          const dist = Math.abs(centerX - primaCenterX);
          const tolerance =
            Math.max(primaItem.width, it.width) * 2 + primaItem.height * 4;
          return dist <= tolerance;
        });

        const anyPrices = below.items.filter((it) => isPriceLike(it.str));
        const priceCandidates = aligned.length > 0 ? aligned : anyPrices;

        if (priceCandidates.length === 0) continue;

        priceCandidates.sort(
          (a, b) =>
            Math.abs(a.x + a.width / 2 - primaCenterX) -
            Math.abs(b.x + b.width / 2 - primaCenterX),
        );

        const closest = priceCandidates[0];
        const id = `p${p}-${closest.x.toFixed(2)}-${closest.y.toFixed(2)}-${closest.str}`;
        if (detected.some((d) => d.id === id)) {
          foundForThisPrima = true;
          break;
        }

        detected.push({
          id,
          pageIndex: p,
          originalText: closest.str,
          newText: closest.str,
          x: closest.x,
          y: closest.y,
          width: closest.width,
          height: closest.height,
          fontSize: closest.height,
        });
        foundForThisPrima = true;
        break;
      }
    }
  }

  await pdf.destroy();
  return detected;
}

async function buildModifiedPdf(
  bytes: ArrayBuffer,
  password: string | undefined,
  prices: DetectedPrice[],
): Promise<Uint8Array> {
  const pdfDoc = await loadPdfDocument(bytes.slice(0), password);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const price of prices) {
    if (price.newText === price.originalText) continue;
    const page = pages[price.pageIndex];
    if (!page) continue;

    const padX = 1;
    const padY = price.fontSize * 0.18;
    const rectX = price.x - padX;
    const rectY = price.y - padY;
    const rectW = price.width + padX * 2 + 4;
    const rectH = price.fontSize * 1.25;

    page.drawRectangle({
      x: rectX,
      y: rectY,
      width: rectW,
      height: rectH,
      color: rgb(1, 1, 1),
    });

    let drawSize = price.fontSize;
    let textWidth = helvetica.widthOfTextAtSize(price.newText, drawSize);
    const maxWidth = price.width + 6;
    while (textWidth > maxWidth && drawSize > 4) {
      drawSize -= 0.5;
      textWidth = helvetica.widthOfTextAtSize(price.newText, drawSize);
    }

    page.drawText(price.newText, {
      x: price.x,
      y: price.y,
      size: drawSize,
      font: helvetica,
      color: rgb(0, 0, 0),
    });
  }

  return await pdfDoc.save({ useObjectStreams: false });
}

let nextId = 0;
const newId = () => `pdf-${++nextId}`;

export default function App() {
  const [pdfs, setPdfs] = useState<PdfEntry[]>([]);
  const [bulkValue, setBulkValue] = useState("");
  const [generating, setGenerating] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updatePdf = useCallback(
    (id: string, updater: (p: PdfEntry) => PdfEntry) => {
      setPdfs((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
    },
    [],
  );

  const processPdf = useCallback(
    async (id: string, bytes: ArrayBuffer, password: string) => {
      try {
        const detected = await detectPrices(bytes, password || undefined);
        updatePdf(id, (p) => ({
          ...p,
          status: { kind: "ready" },
          prices: detected,
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.toLowerCase().includes("password") ||
          msg.toLowerCase().includes("encrypt")
        ) {
          updatePdf(id, (p) => ({
            ...p,
            status: { kind: "needs-password" },
          }));
        } else {
          updatePdf(id, (p) => ({
            ...p,
            status: { kind: "error", message: msg },
          }));
        }
      }
    },
    [updatePdf],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setGlobalError(null);

    const newEntries: PdfEntry[] = [];
    for (const file of Array.from(files)) {
      const buf = await file.arrayBuffer();
      newEntries.push({
        id: newId(),
        file,
        bytes: buf,
        password: "",
        status: { kind: "loading" },
        prices: [],
      });
    }

    setPdfs((prev) => [...prev, ...newEntries]);

    for (const entry of newEntries) {
      processPdf(entry.id, entry.bytes, "");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitPassword = async (id: string) => {
    const entry = pdfs.find((p) => p.id === id);
    if (!entry) return;
    updatePdf(id, (p) => ({ ...p, status: { kind: "loading" } }));
    await processPdf(id, entry.bytes, entry.password);
  };

  const updatePrice = (pdfId: string, priceId: string, value: string) => {
    updatePdf(pdfId, (p) => ({
      ...p,
      prices: p.prices.map((pr) =>
        pr.id === priceId ? { ...pr, newText: value } : pr,
      ),
    }));
  };

  const applyBulkToAll = () => {
    if (!bulkValue.trim()) return;
    setPdfs((prev) =>
      prev.map((p) => ({
        ...p,
        prices: p.prices.map((pr) => ({ ...pr, newText: bulkValue })),
      })),
    );
  };

  const removePdf = (id: string) => {
    setPdfs((prev) => prev.filter((p) => p.id !== id));
  };

  const removeAll = () => {
    setPdfs([]);
    setGlobalError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadOne = async (id: string) => {
    const entry = pdfs.find((p) => p.id === id);
    if (!entry || entry.status.kind !== "ready") return;
    setGlobalError(null);
    try {
      const out = await buildModifiedPdf(
        entry.bytes,
        entry.password || undefined,
        entry.prices,
      );
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entry.file.name.replace(/\.pdf$/i, "")}-modificado.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGlobalError(`Error en ${entry.file.name}: ${msg}`);
    }
  };

  const downloadAll = async () => {
    const ready = pdfs.filter((p) => p.status.kind === "ready");
    if (ready.length === 0) return;
    setGenerating(true);
    setGlobalError(null);

    try {
      if (ready.length === 1) {
        await downloadOne(ready[0].id);
        setGenerating(false);
        return;
      }

      const zip = new JSZip();
      for (const entry of ready) {
        try {
          const out = await buildModifiedPdf(
            entry.bytes,
            entry.password || undefined,
            entry.prices,
          );
          const name = `${entry.file.name.replace(/\.pdf$/i, "")}-modificado.pdf`;
          zip.file(name, out);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setGlobalError((prev) =>
            prev
              ? `${prev}\nError en ${entry.file.name}: ${msg}`
              : `Error en ${entry.file.name}: ${msg}`,
          );
        }
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pdfs-modificados-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  };

  const totalReady = pdfs.filter((p) => p.status.kind === "ready").length;
  const totalPrices = pdfs.reduce((sum, p) => sum + p.prices.length, 0);

  return (
    <div style={{ minHeight: "100vh", padding: "32px 16px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Editor de PDF — PRIMA
          </h1>
          <p
            style={{
              color: "var(--muted)",
              marginTop: 8,
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            Sube uno o varios PDFs (hasta los que quieras a la vez) y modifica
            únicamente el precio que aparece <strong>al lado o debajo</strong>{" "}
            de la palabra <strong>PRIMA</strong>. Los PDFs con restricciones se
            desbloquean automáticamente.
          </p>
        </header>

        <section
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 10,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            1. Selecciona uno o varios PDFs
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={handleFileChange}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "#0f172a",
              color: "var(--text)",
              fontSize: 14,
              cursor: "pointer",
            }}
          />
          {pdfs.length > 0 && (
            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 13,
                color: "var(--muted)",
              }}
            >
              <span>
                {pdfs.length} PDF{pdfs.length === 1 ? "" : "s"} cargado
                {pdfs.length === 1 ? "" : "s"} · {totalPrices} precio
                {totalPrices === 1 ? "" : "s"} detectado
                {totalPrices === 1 ? "" : "s"}
              </span>
              <button
                onClick={removeAll}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                  padding: "4px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Quitar todos
              </button>
            </div>
          )}
        </section>

        {pdfs.length > 0 && totalPrices > 0 && (
          <section
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              placeholder="Aplicar el mismo precio a todos los PDFs"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "#0f172a",
                color: "var(--text)",
                fontSize: 14,
              }}
            />
            <button
              onClick={applyBulkToAll}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text)",
                padding: "10px 16px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              Aplicar a todos
            </button>
          </section>
        )}

        {globalError && (
          <div
            style={{
              padding: 14,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid var(--danger)",
              borderRadius: 12,
              marginBottom: 20,
              color: "var(--danger)",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            {globalError}
          </div>
        )}

        <div style={{ display: "grid", gap: 14 }}>
          {pdfs.map((entry) => (
            <PdfCard
              key={entry.id}
              entry={entry}
              onPasswordChange={(value) =>
                updatePdf(entry.id, (p) => ({ ...p, password: value }))
              }
              onSubmitPassword={() => submitPassword(entry.id)}
              onPriceChange={(priceId, value) =>
                updatePrice(entry.id, priceId, value)
              }
              onRemove={() => removePdf(entry.id)}
              onDownload={() => downloadOne(entry.id)}
            />
          ))}
        </div>

        {totalReady > 0 && (
          <button
            onClick={downloadAll}
            disabled={generating}
            style={{
              marginTop: 24,
              width: "100%",
              background: generating ? "#475569" : "var(--accent)",
              border: "none",
              color: "white",
              padding: "14px 20px",
              borderRadius: 10,
              fontWeight: 600,
              cursor: generating ? "wait" : "pointer",
              fontSize: 15,
            }}
          >
            {generating
              ? "Generando..."
              : totalReady === 1
                ? "Generar y descargar PDF modificado"
                : `Generar y descargar ${totalReady} PDFs modificados (.zip)`}
          </button>
        )}

        <footer
          style={{
            marginTop: 32,
            fontSize: 12,
            color: "var(--muted)",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Todo el procesamiento ocurre en tu navegador. Tus archivos no se
          envían a ningún servidor.
        </footer>
      </div>
    </div>
  );
}

function PdfCard({
  entry,
  onPasswordChange,
  onSubmitPassword,
  onPriceChange,
  onRemove,
  onDownload,
}: {
  entry: PdfEntry;
  onPasswordChange: (value: string) => void;
  onSubmitPassword: () => void;
  onPriceChange: (priceId: string, value: string) => void;
  onRemove: () => void;
  onDownload: () => void;
}) {
  const { file, status, prices } = entry;

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 15,
              wordBreak: "break-all",
            }}
          >
            {file.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginTop: 4,
            }}
          >
            {(file.size / 1024).toFixed(1)} KB
            {status.kind === "ready" && (
              <>
                {" · "}
                {prices.length} precio{prices.length === 1 ? "" : "s"} detectado
                {prices.length === 1 ? "" : "s"}
              </>
            )}
            {status.kind === "loading" && " · Procesando..."}
            {status.kind === "needs-password" && " · Requiere contraseña"}
            {status.kind === "error" && " · Error"}
          </div>
        </div>
        <button
          onClick={onRemove}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--muted)",
            padding: "4px 10px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Quitar
        </button>
      </div>

      {status.kind === "needs-password" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitPassword();
          }}
          style={{ display: "flex", gap: 8, marginBottom: 8 }}
        >
          <input
            type="password"
            value={entry.password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Contraseña del PDF"
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "#0f172a",
              color: "var(--text)",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            style={{
              background: "var(--accent)",
              border: "none",
              color: "white",
              padding: "8px 16px",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Desbloquear
          </button>
        </form>
      )}

      {status.kind === "error" && (
        <div
          style={{
            padding: 10,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid var(--danger)",
            borderRadius: 8,
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          {status.message}
        </div>
      )}

      {status.kind === "ready" && prices.length === 0 && (
        <div
          style={{
            padding: 10,
            background: "rgba(148,163,184,0.08)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--muted)",
            fontSize: 13,
          }}
        >
          No se detectaron precios al lado o debajo de "PRIMA" en este PDF.
        </div>
      )}

      {status.kind === "ready" && prices.length > 0 && (
        <>
          <div style={{ display: "grid", gap: 8 }}>
            {prices.map((p, idx) => (
              <div
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto 1fr",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 10px",
                  background: "#0f172a",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    fontWeight: 600,
                    minWidth: 24,
                  }}
                >
                  #{idx + 1}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--muted)",
                      marginBottom: 2,
                    }}
                  >
                    Original (pág. {p.pageIndex + 1})
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 13,
                      color: "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.originalText}
                  </div>
                </div>
                <span style={{ color: "var(--muted)" }}>→</span>
                <input
                  type="text"
                  value={p.newText}
                  onChange={(e) => onPriceChange(p.id, e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--panel)",
                    color: "var(--text)",
                    fontSize: 13,
                    fontFamily: "monospace",
                    width: "100%",
                  }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={onDownload}
            style={{
              marginTop: 12,
              background: "transparent",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
              padding: "8px 14px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Descargar este PDF modificado
          </button>
        </>
      )}
    </div>
  );
}
