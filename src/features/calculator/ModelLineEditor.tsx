import { useState } from "react";
import { modelGroupLabel, type DoorModel, type InputVariableName, type InputVariables } from "../../domain/catalog/types";
import type { ProjectLineDraft } from "../projects/projectService";
import type { ProjectResultSnapshot } from "../../domain/projects/types";
import { MaterialResults } from "./MaterialResults";

const inputLabels: Partial<Record<InputVariableName, string>> = {
  T1: "T1 · mm",
  L1: "L1 · mm",
  T2: "T2 · mm",
  L2: "L2 · mm",
  T3: "T3 · mm",
  L3: "L3 · mm",
  daunPintu: "Daun pintu",
  daunJendela: "Daun jendela",
};

type ModelLineEditorProps = {
  lines: readonly ProjectLineDraft[];
  models: readonly DoorModel[];
  results: ReadonlyMap<string, ProjectResultSnapshot>;
  onChange(lineId: string, updated: ProjectLineDraft): void;
  onRemove(lineId: string): void;
  onAddModel(modelCode: number): void;
};

export function ModelLineEditor({ lines, models, results, onChange, onRemove, onAddModel }: ModelLineEditorProps) {
  const [modelSearch, setModelSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const query = modelSearch.trim().toLocaleLowerCase("id-ID");
  const matchingModels = models.filter((item) => !query || [String(item.code), item.name, modelGroupLabel(item.groupCode, item.groupName)].some((value) => value.toLocaleLowerCase("id-ID").includes(query))).slice(0, 40);

  return (
    <>
      <div className="model-search-card calculator-model-search-card">
        <div className="model-search-card-heading">
          <span className="model-search-card-icon" aria-hidden="true">⌕</span>
          <div><strong>Cari model kusen</strong><small>Cari berdasarkan kode, nama, atau kelompok, lalu pilih untuk menambahkan baris</small></div>
        </div>
        <div className="model-search-control">
          <input
            id="calculator-model-search"
            type="search"
            autoComplete="off"
            role="combobox"
            aria-label="Cari model kusen"
            aria-expanded={searchOpen}
            aria-controls="calculator-model-search-options"
            placeholder="Cari model berdasarkan kode atau nama…"
            value={modelSearch}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => { setModelSearch(event.target.value); setSearchOpen(true); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchOpen(false);
              if (event.key === "Enter" && matchingModels[0]) {
                event.preventDefault();
                onAddModel(matchingModels[0].code);
                setModelSearch("");
                setSearchOpen(false);
              }
            }}
          />
          {searchOpen && (
            <div className="model-search-options" id="calculator-model-search-options" role="listbox" aria-label="Hasil pencarian model">
              {matchingModels.map((item) => (
                <button className="model-search-option" type="button" role="option" aria-selected={false} key={item.code}
                  onClick={() => { onAddModel(item.code); setModelSearch(""); setSearchOpen(false); }}>
                  <strong>{item.code} · {item.name}</strong><span>{modelGroupLabel(item.groupCode, item.groupName)}</span>
                </button>
              ))}
              {!matchingModels.length && <p className="model-search-empty">Model tidak ditemukan.</p>}
            </div>
          )}
        </div>
      </div>
      <div className="model-line-list">
      {lines.map((line, index) => {
        const lineId = line.id ?? `${line.modelCode}-${index}`;
        const model = models.find((item) => item.code === line.modelCode);
        const result = results.get(lineId) ?? { items: [], errors: [] };
        return (
          <div className="model-line-group" key={lineId}>
            <article className="model-line-card">
              <div className="model-line-heading">
                <span className="line-number">{String(index + 1).padStart(2, "0")}</span>
              <div className="line-model-select">
                <label htmlFor={`model-${lineId}`}>MODEL</label>
                <select id={`model-${lineId}`} value={line.modelCode} onChange={(event) => {
                  const nextCode = Number(event.target.value);
                  onChange(lineId, { ...line, modelCode: nextCode, inputs: {}, formulaSnapshot: undefined, resultSnapshot: undefined });
                }}>
                  {models.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
                </select>
              </div>
              <label className="count-field" htmlFor={`count-${lineId}`}>
                <span>JUMLAH UNIT</span>
                <input
                  id={`count-${lineId}`}
                  type="number"
                  min="1"
                  step="1"
                  value={line.count}
                  onChange={(event) => onChange(lineId, { ...line, count: Math.max(1, Math.floor(Number(event.target.value) || 1)) })}
                />
              </label>
              <button className="icon-button remove-line" type="button" aria-label={`Hapus model ${line.modelCode}`} onClick={() => onRemove(lineId)}>×</button>
            </div>

            {model && (
              <>
                {model.status === "incomplete" && <div className="model-incomplete-tag">Sebagian rumus model ini belum tersedia</div>}
                {model.inputs.length > 0 && (
                  <div className="input-grid">
                    {model.inputs.map((name) => {
                      const value = line.inputs[name];
                      const isCount = name === "daunPintu" || name === "daunJendela";
                      return (
                        <label className="dimension-field" htmlFor={`input-${lineId}-${name}`} key={name}>
                          <span>{inputLabels[name] ?? name}</span>
                          <input
                            id={`input-${lineId}-${name}`}
                            type="number"
                            min="0"
                            step={isCount ? "1" : "any"}
                            inputMode="decimal"
                            value={value ?? ""}
                            placeholder="Belum diisi"
                            onChange={(event) => {
                              const inputs: InputVariables = { ...line.inputs };
                              if (event.target.value === "") delete inputs[name];
                              else {
                                const parsed = Number(event.target.value);
                                inputs[name] = isCount ? Math.max(0, Math.floor(parsed)) : Math.max(0, parsed);
                              }
                              onChange(lineId, { ...line, inputs, formulaSnapshot: undefined, resultSnapshot: undefined });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
                <MaterialResults result={result} />
              </>
            )}
            {!model && <p className="empty-inline">Pilih model dari katalog.</p>}
            </article>
          </div>
        );
      })}
      </div>
    </>
  );
}
