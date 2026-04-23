import { useState } from "react";
import { FileText, X, Download, Printer, Upload, Check, AlertCircle } from "lucide-react";

type Pdf = {
  id: string;
  name: string;
  status: "ready" | "processing" | "needs-password";
  prices: { id: string; original: string; replacement: string }[];
};

const seed: Pdf[] = [
  { id: "1", name: "Factura_Proveedor_2026_001.pdf", status: "ready", prices: [
      { id: "p1", original: "$ 45.230,50", replacement: "48000" },
      { id: "p2", original: "$ 12.800,00", replacement: "13500" },
  ]},
  { id: "2", name: "Cotizacion_Cliente_Marzo.pdf", status: "ready", prices: [
      { id: "p1", original: "$ 128.900,00", replacement: "135000" },
  ]},
  { id: "3", name: "Presupuesto_Q2_PRIMA.pdf", status: "ready", prices: [
      { id: "p1", original: "$ 8.450,00", replacement: "9200" },
      { id: "p2", original: "$ 22.100,75", replacement: "" },
      { id: "p3", original: "$ 67.500,00", replacement: "70000" },
  ]},
  { id: "4", name: "OC_2026_0084.pdf", status: "needs-password", prices: [] },
  { id: "5", name: "Liquidacion_Marzo.pdf", status: "ready", prices: [
      { id: "p1", original: "$ 215.430,00", replacement: "225000" },
  ]},
];

export function SidebarWorkspace() {
  const [pdfs, setPdfs] = useState(seed);
  const [activeId, setActiveId] = useState("3");
  const active = pdfs.find((p) => p.id === activeId);

  const updatePrice = (priceId: string, value: string) => {
    setPdfs((prev) => prev.map((p) => p.id !== activeId ? p : {
      ...p, prices: p.prices.map((pr) => pr.id === priceId ? { ...pr, replacement: value } : pr),
    }));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-['Inter']">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">SOAP EDITOR</h1>
          <p className="text-xs text-slate-400">Reemplaza únicamente los precios contiguos a "PRIMA"</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium border border-slate-700">
            <Download className="w-4 h-4" /> Descargar todo (.zip)
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium">
            <Printer className="w-4 h-4" /> Imprimir todo
          </button>
        </div>
      </header>

      <div className="grid grid-cols-[320px_1fr] h-[calc(100vh-73px)]">
        <aside className="border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <label className="block">
              <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-blue-500 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                <div className="text-xs text-slate-400">Arrastra o haz clic para subir</div>
                <div className="text-[10px] text-slate-500 mt-0.5">PDF · múltiples archivos</div>
              </div>
            </label>
            <div className="mt-3 flex items-center gap-2">
              <input
                placeholder="Aplicar precio a todos"
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                defaultValue="50000"
              />
              <button className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded font-medium">Aplicar</button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            <div className="px-4 py-2 text-[10px] uppercase text-slate-500 tracking-wider">{pdfs.length} archivos</div>
            {pdfs.map((p) => {
              const isActive = p.id === activeId;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  className={`w-full text-left px-4 py-3 border-l-2 transition-colors ${
                    isActive ? "bg-slate-800 border-blue-500" : "border-transparent hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {p.status === "ready" && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><Check className="w-2.5 h-2.5" /> {p.prices.length} precios</span>}
                        {p.status === "needs-password" && <span className="text-[10px] text-amber-400 flex items-center gap-1"><AlertCircle className="w-2.5 h-2.5" /> Contraseña</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="overflow-y-auto p-8">
          {active && (
            <div className="max-w-3xl">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Editando</div>
                  <h2 className="text-lg font-semibold">{active.name}</h2>
                </div>
                <button className="text-slate-500 hover:text-red-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-300">Precios detectados junto a PRIMA</h3>
                  <span className="text-xs text-slate-500">{active.prices.length} encontrados</span>
                </div>

                <div className="space-y-3">
                  {active.prices.map((price, idx) => (
                    <div key={price.id} className="grid grid-cols-[24px_1fr_24px_1fr] items-center gap-3">
                      <span className="text-xs text-slate-500 font-mono">#{idx + 1}</span>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Original</div>
                        <div className="bg-slate-900/50 border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-400 line-through">{price.original}</div>
                      </div>
                      <div className="text-slate-600 text-center">→</div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Nuevo</div>
                        <input
                          value={price.replacement}
                          onChange={(e) => updatePrice(price.id, e.target.value)}
                          placeholder="Sin cambios"
                          className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded px-3 py-2 text-sm font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-700 flex items-center justify-between">
                  <div className="text-xs text-slate-500">El resto del documento permanece intacto.</div>
                  <div className="flex gap-2">
                    <button className="text-xs px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600">Descargar este</button>
                    <button className="text-xs px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500">Imprimir este</button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center mt-6">Todo el procesamiento ocurre en tu navegador. Tus archivos no se envían a ningún servidor.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
