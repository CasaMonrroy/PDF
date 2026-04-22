import { useState, useRef, useCallback } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

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

const PRICE_REGEX = /^\$?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?$|^\$?\s?\d+$/;

function isPriceLike(s: string) {
  const trimmed = s.trim();
  if (!trimmed) return false;
  if (!/\d/.test(trimmed)) return false;
  return PRICE_REGEX.test(trimmed);
}

async function loadPdfDocument(
  bytes: ArrayBuffer,
  password: string | undefined,
): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      ...(password ? { password } : {}),
    } as Parameters<typeof PDFDocument.load>[1]);
  } catch (err) {
    throw err;
  }
}

async function detectPrices(
  bytes: ArrayBuffer,
  password: string | undefined,
): Promise<DetectedPrice[]> {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
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

    type PosItem = {
      str: string;
      x: number;
      y: number;
      width: number;
      height: number;
    };

    const positioned: PosItem[] = items
      .filter((it) => typeof it.str === "string")
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width,
        height: it.height || Math.abs(it.transform[3]) || 10,
      }));

    const primaItems = positioned.filter((it) =>
      /PRIMA/i.test(it.str.trim()),
    );

    for (const prima of primaItems) {
      const primaCenterX = prima.x + prima.width / 2;

      const candidates = positioned
        .filter((it) => {
          if (it === prima) return false;
          if (it.y >= prima.y) return false;
          const verticalGap = prima.y - it.y;
          if (verticalGap > prima.height * 8) return false;
          const itemCenterX = it.x + it.width / 2;
          const horizontalDist = Math.abs(itemCenterX - primaCenterX);
          const maxHorizontal = Math.max(prima.width, it.width) * 1.5 + 30;
          if (horizontalDist > maxHorizontal) return false;
          if (!isPriceLike(it.str)) return false;
          return true;
        })
        .sort((a, b) => b.y - a.y);

      if (candidates.length === 0) continue;

      const topY = candidates[0].y;
      const sameRowTolerance = candidates[0].height * 0.6;
      const closest = candidates.find(
        (c) => Math.abs(c.y - topY) <= sameRowTolerance,
      )!;

      const id = `p${p}-${closest.x.toFixed(2)}-${closest.y.toFixed(2)}-${closest.str}`;
      if (detected.some((d) => d.id === id)) continue;

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
  const pdfDoc = await loadPdfDocument(bytes, password);
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

type Status =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "needs-password" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [prices, setPrices] = useState<DetectedPrice[]>([]);
  const [bulkValue, setBulkValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (raw: ArrayBuffer, pwd: string | undefined) => {
      setStatus({ kind: "loading", message: "Procesando PDF..." });
      try {
        const detected = await detectPrices(raw, pwd);
        setPrices(detected);
        setBytes(raw);
        setStatus({ kind: "ready" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.toLowerCase().includes("password") ||
          msg.toLowerCase().includes("encrypt")
        ) {
          setBytes(raw);
          setStatus({ kind: "needs-password" });
        } else {
          setStatus({
            kind: "error",
            message: `No se pudo procesar el PDF: ${msg}`,
          });
        }
      }
    },
    [],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPassword("");
    setPrices([]);
    const buf = await f.arrayBuffer();
    await processFile(buf, undefined);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bytes) return;
    await processFile(bytes, password);
  };

  const handleDownload = async () => {
    if (!bytes || !file) return;
    setStatus({ kind: "loading", message: "Generando PDF modificado..." });
    try {
      const out = await buildModifiedPdf(
        bytes,
        password || undefined,
        prices,
      );
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = file.name.replace(/\.pdf$/i, "");
      a.download = `${baseName}-modificado.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({ kind: "ready" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({
        kind: "error",
        message: `Error al generar el PDF: ${msg}`,
      });
    }
  };

  const updatePrice = (id: string, value: string) => {
    setPrices((prev) =>
      prev.map((p) => (p.id === id ? { ...p, newText: value } : p)),
    );
  };

  const applyBulk = () => {
    if (!bulkValue.trim()) return;
    setPrices((prev) => prev.map((p) => ({ ...p, newText: bulkValue })));
  };

  const reset = () => {
    setFile(null);
    setBytes(null);
    setPassword("");
    setPrices([]);
    setStatus({ kind: "idle" });
    setBulkValue("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div style={{ minHeight: "100vh", padding: "32px 16px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <header style={{ marginBottom: 32 }}>
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
            Sube un PDF y modifica únicamente los precios que aparecen
            inmediatamente debajo de la palabra <strong>PRIMA</strong>. Si el
            PDF tiene restricciones, se desbloquea automáticamente.
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
            1. Selecciona un PDF
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
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
          {file && (
            <div
              style={{
                marginTop: 12,
                fontSize: 13,
                color: "var(--muted)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                Archivo: <strong style={{ color: "var(--text)" }}>{file.name}</strong>
              </span>
              <button
                onClick={reset}
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
                Limpiar
              </button>
            </div>
          )}
        </section>

        {status.kind === "needs-password" && (
          <section
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
              marginBottom: 20,
            }}
          >
            <form onSubmit={handlePasswordSubmit}>
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
                Este PDF requiere contraseña
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña del PDF"
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
                  type="submit"
                  style={{
                    background: "var(--accent)",
                    border: "none",
                    color: "white",
                    padding: "10px 20px",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Desbloquear
                </button>
              </div>
            </form>
          </section>
        )}

        {status.kind === "loading" && (
          <div
            style={{
              padding: 16,
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              marginBottom: 20,
              color: "var(--muted)",
              fontSize: 14,
            }}
          >
            {status.message}
          </div>
        )}

        {status.kind === "error" && (
          <div
            style={{
              padding: 16,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid var(--danger)",
              borderRadius: 12,
              marginBottom: 20,
              color: "var(--danger)",
              fontSize: 14,
            }}
          >
            {status.message}
          </div>
        )}

        {status.kind === "ready" && (
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
              2. Precios encontrados debajo de "PRIMA"
            </label>

            {prices.length === 0 ? (
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: 14,
                  margin: "12px 0 0",
                }}
              >
                No se detectaron precios debajo de la palabra "PRIMA" en este
                PDF.
              </p>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 16,
                    paddingBottom: 16,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <input
                    type="text"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    placeholder="Aplicar el mismo valor a todos (opcional)"
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
                    onClick={applyBulk}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      padding: "8px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    Aplicar a todos
                  </button>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {prices.map((p, idx) => (
                    <div
                      key={p.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto 1fr",
                        gap: 12,
                        alignItems: "center",
                        padding: "10px 12px",
                        background: "#0f172a",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--muted)",
                          fontWeight: 600,
                          minWidth: 28,
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--muted)",
                            marginBottom: 2,
                          }}
                        >
                          Original (pág. {p.pageIndex + 1})
                        </div>
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: 14,
                            color: "var(--text)",
                          }}
                        >
                          {p.originalText}
                        </div>
                      </div>
                      <span style={{ color: "var(--muted)" }}>→</span>
                      <input
                        type="text"
                        value={p.newText}
                        onChange={(e) => updatePrice(p.id, e.target.value)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--panel)",
                          color: "var(--text)",
                          fontSize: 14,
                          fontFamily: "monospace",
                          width: "100%",
                        }}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleDownload}
                  style={{
                    marginTop: 20,
                    width: "100%",
                    background: "var(--accent)",
                    border: "none",
                    color: "white",
                    padding: "12px 20px",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 15,
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = "var(--accent-hover)")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = "var(--accent)")
                  }
                >
                  Generar y descargar PDF modificado
                </button>
              </>
            )}
          </section>
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
