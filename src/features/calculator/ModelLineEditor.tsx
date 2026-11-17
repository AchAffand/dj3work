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
};

export function ModelLineEditor({ lines, models, results, onChange, onRemove }: ModelLineEditorProps) {
  const [searchByLine, setSearchByLine] = useState<Record<string, string>>({});
  const [openLineId, setOpenLineId] = useState<string | null>(null);

  return (
    <div className="model-line-list">
      {lines.map((line, index) => {
        const lineId = line.id ?? `${line.modelCode}-${index}`;
        const model = models.find((item) => item.code === line.modelCode);
        const result = results.get(lineId) ?? { items: [], errors: [] };
        return (
          <div className="model-line-group" key={lineId}>
            <div className="model-search-card">
              <div className="model-search-card-heading">
                <span className="model-search-card-icon" aria-hidden="true">⌕</span>
                <div><strong>Cari model kusen</strong><small>Ketik kode, nama, atau kelompok model</small></div>
              </div>
              <div className="model-search-control">
                <div className="model-search-control">
                  <input
                    id={`model-${lineId}`}
                    type="search"
                    autoComplete="off"
                    role="combobox"
                    aria-label={`Cari model untuk baris ${index + 1}`}
                    aria-expanded={openLineId === lineId}
                    aria-controls={`model-options-${lineId}`}
                    placeholder="Cari model berdasarkan kode atau nama…"
                    value={openLineId === lineId ? (searchByLine[lineId] ?? "") : ""}
                    onFocus={() => {
                      setOpenLineId(lineId);
                      setSearchByLine((current) => ({ ...current, [lineId]: "" }));
                    }}
                    onChange={(event) => {
                      setOpenLineId(lineId);
                      setSearchByLine((current) => ({ ...current, [lineId]: event.target.value }));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setOpenLineId(null);
                      if (event.key === "Enter") {
                        event.preventDefault();
                        const query = (searchByLine[lineId] ?? "").trim().toLocaleLowerCase();
                        const matches = models.filter((item) => !query || [String(item.code), item.name, modelGroupLabel(item.groupCode, item.groupName)].some((value) => value.toLocaleLowerCase().includes(query)));
                        if (matches[0]) {
                          onChange(lineId, { ...line, modelCode: matches[0].code, inputs: {}, formulaSnapshot: undefined, resultSnapshot: undefined });
                          setOpenLineId(null);
                        }
                      }
                    }}
                  />
                  {model && <span className="model-search-selected">Terpilih: {model.code} · {model.name}</span>}
                  {openLineId === lineId && (
                    <div className="model-search-options" id={`model-options-${lineId}`} role="listbox" aria-label="Hasil pencarian model">
                      {models.filter((item) => {
                        const query = (searchByLine[lineId] ?? "").trim().toLocaleLowerCase();
                        return !query || [String(item.code), item.name, modelGroupLabel(item.groupCode, item.groupName)].some((value) => value.toLocaleLowerCase().includes(query));
                      }).slice(0, 40).map((item) => (
                        <button
                          className="model-search-option"
                          type="button"
                          role="option"
                          aria-selected={item.code === line.modelCode}
                          key={item.code}
                          onClick={() => {
                            onChange(lineId, { ...line, modelCode: item.code, inputs: {}, formulaSnapshot: undefined, resultSnapshot: undefined });
                            setSearchByLine((current) => ({ ...current, [lineId]: "" }));
                            setOpenLineId(null);
                          }}
                        >
                          <strong>{item.code} · {item.name}</strong>
                          <span>{modelGroupLabel(item.groupCode, item.groupName)}</span>
                        </button>
                      ))}
                      {models.filter((item) => {
                        const query = (searchByLine[lineId] ?? "").trim().toLocaleLowerCase();
                        return !query || [String(item.code), item.name, modelGroupLabel(item.groupCode, item.groupName)].some((value) => value.toLocaleLowerCase().includes(query));
                      }).length === 0 && <p className="model-search-empty">Model tidak ditemukan.</p>}
                    </div>
                  )}
              </div>
            </div>
            <article className="model-line-card">
              <div className="model-line-heading">
                <span className="line-number">{String(index + 1).padStart(2, "0")}</span>
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
  );
}
