import { useState } from "react";
import { Upload, Edit3, Printer, Check, ChevronRight, ChevronLeft, FileText, Download } from "lucide-react";

const files = [
  { name: "Factura_Proveedor_2026_001.pdf", prices: [{ o: "$ 45.230,50", n: "48000" }, { o: "$ 12.800,00", n: "13500" }] },
  { name: "Cotizacion_Cliente_Marzo.pdf", prices: [{ o: "$ 128.900,00", n: "135000" }] },
  { name: "Presupuesto_Q2_PRIMA.pdf", prices: [{ o: "$ 8.450,00", n: "9200" }, { o: "$ 22.100,75", n: "23000" }] },
];

export function StepperWizard() {
  const [step, setStep] = useState(2);

  const steps = [
    { n: 1, label: "Subir PDFs", icon: Upload },
    { n: 2, label: "Editar precios", icon: Edit3 },
    { n: 3, label: "Descargar / Imprimir", icon: Printer },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-['Inter']">
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">SOAP EDITOR</h1>
          <p className="text-sm text-slate-400">Modifica únicamente el precio que aparece al lado o debajo de la palabra <span className="font-bold text-slate-200">PRIMA</span></p>
        </div>

        <div className="flex items-center justify-between mb-12 px-12">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const done = step > s.n;
            const current = step === s.n;
            return (
              <div key={s.n} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                    done ? "bg-emerald-600 border-emerald-600" :
                    current ? "bg-blue-600 border-blue-500" : "bg-slate-800 border-slate-700"
                  }`}>
                    {done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className={`text-xs font-medium ${current ? "text-slate-100" : "text-slate-500"}`}>{s.label}</div>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 mb-7 ${done ? "bg-emerald-600" : "bg-slate-700"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-8">
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold mb-1">Selecciona tus archivos PDF</h2>
              <p className="text-xs text-slate-400 mb-6">Puedes subir varios a la vez. Los PDFs con restricciones se desbloquean automáticamente.</p>
              <label className="block">
                <div className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center hover:border-blue-500 cursor-pointer">
                  <Upload className="w-10 h-10 mx-auto text-slate-500 mb-3" />
                  <div className="text-sm font-medium mb-1">Arrastra tus PDFs aquí</div>
                  <div className="text-xs text-slate-500">o haz clic para seleccionar</div>
                </div>
              </label>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">Editar precios detectados</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{files.length} archivos · {files.reduce((s, f) => s + f.prices.length, 0)} precios encontrados</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg p-1">
                  <input placeholder="Aplicar a todos" defaultValue="50000" className="bg-transparent text-xs px-2 py-1 w-32 focus:outline-none" />
                  <button className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded font-medium">Aplicar</button>
                </div>
              </div>

              <div className="space-y-3">
                {files.map((f, fi) => (
                  <div key={fi} className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{f.name}</span>
                      </div>
                      <span className="text-xs text-slate-500 flex-shrink-0 ml-3">{f.prices.length} precios</span>
                    </div>
                    <div className="p-4 space-y-2">
                      {f.prices.map((p, pi) => (
                        <div key={pi} className="grid grid-cols-[1fr_24px_1fr] items-center gap-3">
                          <div className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-400 line-through">{p.o}</div>
                          <ChevronRight className="w-4 h-4 text-slate-600 mx-auto" />
                          <input defaultValue={p.n} className="bg-slate-800 border border-slate-700 focus:border-blue-500 rounded px-3 py-1.5 text-xs font-mono focus:outline-none" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold mb-1">Listo para procesar</h2>
              <p className="text-xs text-slate-400 mb-8">Todos los cambios se aplicaron. Elige cómo quieres recibir tus PDFs modificados.</p>
              <div className="grid grid-cols-2 gap-4">
                <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-6 text-left">
                  <Download className="w-7 h-7 text-blue-400 mb-3" />
                  <div className="font-semibold mb-1">Descargar archivos</div>
                  <div className="text-xs text-slate-400">Recibe los {files.length} PDFs modificados como archivo .zip</div>
                </button>
                <button className="bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/40 rounded-xl p-6 text-left">
                  <Printer className="w-7 h-7 text-emerald-400 mb-3" />
                  <div className="font-semibold mb-1">Enviar a impresora</div>
                  <div className="text-xs text-slate-400">Imprime los {files.length} PDFs juntos con tu impresora predeterminada</div>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="flex items-center gap-1 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" /> Atrás
          </button>
          <div className="text-xs text-slate-500">Paso {step} de 3</div>
          <button
            onClick={() => setStep(Math.min(3, step + 1))}
            disabled={step === 3}
            className="flex items-center gap-1 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-30"
          >
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 text-center mt-8">Todo el procesamiento ocurre en tu navegador. Tus archivos no se envían a ningún servidor.</p>
      </div>
    </div>
  );
}
