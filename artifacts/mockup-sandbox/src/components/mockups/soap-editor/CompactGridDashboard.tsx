import { FileText, Upload, Download, Printer, X, AlertCircle, Check, Sparkles } from "lucide-react";

const files = [
  { name: "Factura_Proveedor_2026_001.pdf", prices: [{ o: "$ 45.230,50", n: "48000" }, { o: "$ 12.800,00", n: "13500" }], status: "ready" },
  { name: "Cotizacion_Cliente_Marzo.pdf", prices: [{ o: "$ 128.900,00", n: "135000" }], status: "ready" },
  { name: "Presupuesto_Q2_PRIMA.pdf", prices: [{ o: "$ 8.450,00", n: "9200" }, { o: "$ 22.100,75", n: "23000" }, { o: "$ 67.500,00", n: "70000" }], status: "ready" },
  { name: "OC_2026_0084.pdf", prices: [], status: "password" },
  { name: "Liquidacion_Marzo.pdf", prices: [{ o: "$ 215.430,00", n: "225000" }], status: "ready" },
  { name: "Comprobante_PRIMA_Abril.pdf", prices: [{ o: "$ 34.700,00", n: "36000" }, { o: "$ 5.200,00", n: "5500" }], status: "ready" },
  { name: "Recibo_2026_0142.pdf", prices: [{ o: "$ 19.800,00", n: "" }], status: "ready" },
  { name: "Factura_Marzo_PRIMA.pdf", prices: [{ o: "$ 88.400,00", n: "92000" }], status: "ready" },
];

export function CompactGridDashboard() {
  const ready = files.filter((f) => f.status === "ready").length;
  const totalPrices = files.reduce((s, f) => s + f.prices.length, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-['Inter']">
      <header className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        <div className="px-6 py-3 flex items-center gap-6">
          <div className="flex-shrink-0">
            <h1 className="text-base font-bold tracking-tight">SOAP EDITOR</h1>
            <div className="text-[10px] text-slate-500">Edición masiva de precios PRIMA</div>
          </div>

          <div className="flex items-center gap-3 flex-1">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer text-xs font-medium border border-slate-700">
              <Upload className="w-3.5 h-3.5" /> Agregar PDFs
            </label>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <input placeholder="Aplicar precio a todos" defaultValue="50000" className="bg-transparent text-xs w-44 focus:outline-none" />
              <button className="text-xs bg-blue-600 hover:bg-blue-500 px-2.5 py-1 rounded font-medium">Aplicar a {ready}</button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div><span className="text-slate-100 font-bold">{files.length}</span> archivos</div>
            <div><span className="text-emerald-400 font-bold">{totalPrices}</span> precios</div>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium border border-slate-700">
              <Download className="w-3.5 h-3.5" /> .zip
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium">
              <Printer className="w-3.5 h-3.5" /> Imprimir todo
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {files.map((f, fi) => (
            <div key={fi} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between p-3 border-b border-slate-800">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div className="w-8 h-10 bg-gradient-to-b from-blue-500/20 to-blue-500/5 border border-blue-500/30 rounded flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{f.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {f.status === "ready" ? (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> {f.prices.length} {f.prices.length === 1 ? "precio" : "precios"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" /> Requiere contraseña
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button className="text-slate-600 hover:text-red-400 flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3">
                {f.status === "password" ? (
                  <input
                    type="password"
                    placeholder="Ingresa contraseña…"
                    className="w-full bg-slate-800 border border-amber-500/40 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400"
                  />
                ) : f.prices.length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic text-center py-3">No se detectaron precios PRIMA</div>
                ) : (
                  <div className="space-y-1.5">
                    {f.prices.map((p, pi) => (
                      <div key={pi} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-mono w-3">{pi + 1}</span>
                        <span className="text-[10px] text-slate-500 line-through font-mono truncate flex-1 min-w-0">{p.o}</span>
                        <input
                          defaultValue={p.n}
                          placeholder="Nuevo"
                          className="bg-slate-800 border border-slate-700 focus:border-blue-500 rounded px-2 py-1 text-[11px] font-mono focus:outline-none w-24 flex-shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {f.status === "ready" && f.prices.length > 0 && (
                <div className="px-3 py-2 border-t border-slate-800 flex items-center justify-end gap-1.5 bg-slate-900/60">
                  <button className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800">Descargar</button>
                  <button className="text-[10px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-slate-800">Imprimir</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-500 text-center mt-8">Todo el procesamiento ocurre en tu navegador. Tus archivos no se envían a ningún servidor.</p>
      </main>
    </div>
  );
}
