import { Fragment, useState } from "react";
import { budgetPriceForMaterial } from "../../domain/budgets/pricing";
import { formatQuantity, formatRupiah } from "../../app/format";
import type { BudgetCatalog, BudgetCatalogDetail } from "../../domain/budgets/types";
import type { MaterialSelection } from "../projects/projectService";
import type { ProjectExtraMaterial } from "../../domain/projects/types";
import type { MaterialRecapRow } from "./aggregateMaterials";
import {
  aluminiumBrands,
  aluminiumFinishes,
  aluminiumVariantId,
  catalogForFamily,
  componentLabel,
  materialFamily,
  relatedMaterialComponents,
  supportsMultipleBudgetComponents,
} from "./materialSelection";

type MaterialRecapProps = {
  rows: readonly MaterialRecapRow[];
  modelLines: { id: string; modelIndex: number; modelCode: number; modelName: string; modelCount: number }[];
  total: number;
  budgetCatalogs: readonly BudgetCatalog[];
  budgetDetails: ReadonlyMap<string, BudgetCatalogDetail>;
  onSelectionChange(modelIndex: number, materialCode: number, selection: MaterialSelection): void;
  onPriceChange(priceKey: string, unitPrice: number | undefined): void;
  extraMaterials: readonly ProjectExtraMaterial[];
  onExtraMaterialsChange(items: ProjectExtraMaterial[]): void;
};

function createMaterialId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function displayMaterialName(name: string): string {
  if (/^kaca\s*\/\s*acp\s*\/\s*sp(?:a)?ndrel\s*\/\s*pintu$/i.test(name.trim())) {
    return "Kaca/ACP/Spandrel/Pintu";
  }
  return name;
}

const familyLabels = {
  aluminium: "ALUMINIUM",
  glass: "KACA",
  accessory: "AKSESORIS",
  "door-leaf": "DAUN PINTU",
} as const;

export function MaterialRecap({ rows, modelLines, total, budgetCatalogs, budgetDetails, onSelectionChange, onPriceChange, extraMaterials, onExtraMaterialsChange }: MaterialRecapProps) {
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [selectedComponentId, setSelectedComponentId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantityPerModel, setQuantityPerModel] = useState("1");
  const missingPrices = rows.filter((row) => row.unitPrice === null).length
    + extraMaterials.filter((item) => item.unitPrice === null && item.componentId).length;
  const visibleExtraMaterials = extraMaterials.filter((item) =>
    !item.name.startsWith("__door_finish__:") && !item.name.startsWith("__formula_option__:"),
  );
  const legacyExtraMaterials = visibleExtraMaterials.filter((item) => !item.modelLineId);
  const activeModelLine = modelLines.find((line) => line.id === pendingModelId);
  const selectedCatalogDetail = selectedCatalogId ? budgetDetails.get(selectedCatalogId) : undefined;
  const selectedComponent = selectedCatalogDetail?.components.find((item) => item.id === selectedComponentId);
  const selectedVariant = selectedCatalogDetail?.variants.find((item) => item.id === selectedVariantId);
  const selectedPrice = selectedComponent && selectedVariantId
    ? budgetPriceForMaterial(selectedCatalogDetail, -999999, selectedComponent.label, selectedComponent.unit, selectedVariantId, null, null, null, null, null, selectedComponent.id)
    : null;
  const openAddMaterial = (modelLineId: string) => {
    setSelectedCatalogId(""); setSelectedComponentId(""); setSelectedVariantId(""); setQuantityPerModel("1");
    setPendingModelId(modelLineId);
  };
  const confirmAddMaterial = () => {
    if (!activeModelLine || !selectedCatalogDetail || !selectedComponent || !selectedVariantId) return;
    const quantity = Number(quantityPerModel);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    onExtraMaterialsChange([...extraMaterials, {
      id: createMaterialId(), modelLineId: activeModelLine.id, name: selectedComponent.label,
      unit: selectedComponent.unit, quantity, catalogId: selectedCatalogDetail.catalog.id,
      variantId: selectedVariantId, componentId: selectedComponent.id,
      unitPrice: selectedPrice?.unitPrice ?? null, priceVersion: selectedPrice?.priceVersion ?? null,
      expressionSnapshot: selectedPrice?.expressionSnapshot ?? null,
    }]);
    setPendingModelId(null);
  };
  return (
    <section className="recap-card">
      <div className="recap-heading">
        <div><p className="eyebrow">RINGKASAN KEBUTUHAN</p><h2>Rekap material</h2></div>
        <span className="recap-count">{rows.length + extraMaterials.length} item</span>
      </div>
      {rows.length === 0 ? (
        <div className="recap-empty"><span className="recap-empty-mark">↗</span><strong>Rekap akan muncul di sini</strong><p>Pilih model dan isi ukuran untuk melihat total bahan.</p></div>
      ) : (
        <div className="recap-table-wrap">
          <table className="recap-table">
            <thead><tr><th>Material</th><th>Kebutuhan</th><th>Pilihan material</th><th>Harga satuan</th><th>Jumlah</th></tr></thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const previousRow = rows[rowIndex - 1];
                const modelLine = modelLines.find((line) => line.modelIndex === row.modelIndex);
                const family = materialFamily(row.name, row.unit);
                const inferredCatalog = catalogForFamily(family, budgetCatalogs);
                const multiSelectable = supportsMultipleBudgetComponents(row.name);
                const catalogId = multiSelectable ? (row.catalogId ?? "") : (inferredCatalog?.id ?? row.catalogId ?? "");
                const detail = catalogId ? budgetDetails.get(catalogId) : undefined;
                const selectedVariant = detail?.variants.find((variant) => variant.id === row.variantId);
                const components = relatedMaterialComponents(detail, family, row.name);
                const selection = (patch: Partial<MaterialSelection>) => onSelectionChange(row.modelIndex, row.materialCode, {
                  catalogId: catalogId || null,
                  variantId: row.variantId,
                  componentId: row.componentId,
                  ...patch,
                });


                return (
                  <Fragment key={`${row.modelIndex}-${row.materialCode}-${row.unit}-${row.priceKey}`}>
                    {row.modelIndex !== previousRow?.modelIndex && <tr className="recap-model-divider"><td colSpan={5}><div className="recap-model-heading"><span className="recap-model-number">{String(row.modelIndex).padStart(2, "0")}</span><span className="recap-model-label">Model</span><span className="recap-model-name">- {row.modelCode ?? "—"} ({row.modelName ?? "Nama model tidak tersedia"})</span><span className="recap-model-rule" />{modelLine && <button className="secondary-button recap-add-model-material" type="button" onClick={() => openAddMaterial(modelLine.id)}>＋ Tambah material</button>}</div></td></tr>}
                    <tr>
                    <td><span className="recap-material-name">{displayMaterialName(row.name)}</span><small className="recap-material-code">{row.materialCode} · {row.unit}</small></td>
                    <td className="recap-quantity">{formatQuantity(row.quantity)} <span>{row.unit}</span></td>
                    <td>
                      {multiSelectable ? (
                        <div className="recap-selection-stack">
                          <label className="recap-select-field">
                            <span className="sr-only">Katalog material {row.name}</span>
                            <select value={row.catalogId ?? ""} onChange={(event) => {
                              const nextId = event.target.value || null;
                              const nextDetail = nextId ? budgetDetails.get(nextId) : undefined;
                              const defaultVariant = nextDetail?.variants.find((variant) => variant.key === "brown") ?? nextDetail?.variants[0];
                              onSelectionChange(row.modelIndex, row.materialCode, { catalogId: nextId, variantId: defaultVariant?.id ?? null, componentId: null });
                            }}>
                              <option value="">Pilih katalog</option>
                              {budgetCatalogs.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                            </select>
                          </label>
                          {detail && detail.components.length > 0 && (
                            <label className="recap-select-field">
                              <span className="sr-only">Pilih item katalog untuk {row.name}</span>
                              <select value={row.componentId ?? ""} onChange={(event) => selection({
                                componentId: event.target.value || null,
                                variantId: detail.variants.length === 1 ? detail.variants[0].id : row.variantId,
                              })}>
                                <option value="">Pilih item katalog</option>
                                {detail.components.map((component) => <option key={component.id} value={component.id}>{componentLabel(component)}</option>)}
                              </select>
                            </label>
                          )}
                          {detail && detail.variants.length > 1 && (
                            <label className="recap-select-field">
                              <span className="sr-only">Varian harga {row.name}</span>
                              <select value={row.variantId ?? ""} onChange={(event) => selection({ variantId: event.target.value || null })}>
                                <option value="">Pilih varian harga</option>
                                {detail.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
                              </select>
                            </label>
                          )}
                        </div>
                      ) : family === "aluminium" && detail ? (
                        <div className="recap-selection-stack">
                          <span className="recap-family-tag">ALUMINIUM</span>
                          <label className="recap-select-field">
                            <span className="sr-only">{/\bkusen\b/i.test(row.name) ? "Ukuran profil kusen" : "Komponen aluminium"} {row.name}</span>
                            <select value={row.componentId ?? ""} onChange={(event) => selection({ componentId: event.target.value || null })}>
                              <option value="">{/\bkusen\b/i.test(row.name) ? "Pilih profil kusen" : "Pilih komponen aluminium"}</option>
                              {components.map((component) => <option key={component.id} value={component.id}>{componentLabel(component)}</option>)}
                            </select>
                          </label>
                          <div className="recap-select-pair">
                            <label className="recap-select-field">
                              <span className="sr-only">Merek aluminium</span>
                              <select value={selectedVariant ? selectedVariant.label.split("·")[0]?.trim() : ""} onChange={(event) => {
                                const brand = event.target.value;
                                const finish = aluminiumFinishes(detail, brand)[0] ?? "";
                                selection({ variantId: aluminiumVariantId(detail, brand, finish) });
                              }}>
                                <option value="">Pilih merek</option>
                                {aluminiumBrands(detail).map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                              </select>
                            </label>
                            <label className="recap-select-field">
                              <span className="sr-only">Warna atau finishing aluminium</span>
                              <select value={selectedVariant ? selectedVariant.label.split("·").slice(1).join("·").trim() : ""} disabled={!selectedVariant} onChange={(event) => {
                                const brand = selectedVariant?.label.split("·")[0]?.trim() ?? "";
                                selection({ variantId: aluminiumVariantId(detail, brand, event.target.value) });
                              }}>
                                <option value="">Pilih warna / finishing</option>
                                {aluminiumFinishes(detail, selectedVariant?.label.split("·")[0]?.trim() ?? "").map((finish) => <option key={finish} value={finish}>{finish}</option>)}
                              </select>
                            </label>
                          </div>
                        </div>
                      ) : family !== "other" && detail ? (
                        <div className="recap-selection-stack">
                          <span className="recap-family-tag">{familyLabels[family]}</span>
                          <label className="recap-select-field">
                            <span className="sr-only">Pilih jenis {row.name}</span>
                            <select value={row.componentId ?? ""} onChange={(event) => selection({ componentId: event.target.value || null })}>
                              <option value="">Pilih jenis material</option>
                              {components.map((component) => <option key={component.id} value={component.id}>{componentLabel(component)}</option>)}
                            </select>
                          </label>
                          {family === "door-leaf" && (
                            <label className="recap-select-field">
                              <span className="sr-only">Finishing daun pintu {row.name}</span>
                              <select value={extraMaterials.find((item) => item.name === `__door_finish__:${row.materialCode}`)?.componentId ?? ""} onChange={(event) => {
                                const finishId = event.target.value;
                                const finish = detail.components.find((component) => component.id === finishId);
                                const key = `__door_finish__:${row.materialCode}`;
                                const existing = extraMaterials.find((item) => item.name === key);
                                const next = extraMaterials.filter((item) => item.name !== key);
                                if (finish) next.push({
                                  id: existing?.id ?? createMaterialId(),
                                  name: key, unit: finish.unit, quantity: row.quantity, catalogId: detail.catalog.id,
                                  variantId: row.variantId, componentId: finish.id, unitPrice: null,
                                });
                                onExtraMaterialsChange(next);
                              }}>
                                <option value="">Tanpa finishing</option>
                                {detail.components.filter((component) => /melamin|finishing duco/i.test(component.label)).map((component) => <option key={component.id} value={component.id}>{componentLabel(component)}</option>)}
                              </select>
                              {extraMaterials.find((item) => item.name === `__door_finish__:${row.materialCode}`)?.unitPrice != null && (
                                <small>Tambahan finishing: {formatRupiah(extraMaterials.find((item) => item.name === `__door_finish__:${row.materialCode}`)!.unitPrice!)} · Qty {formatQuantity(row.quantity)}</small>
                              )}
                            </label>
                          )}
                          {detail.variants.length > 1 && (
                            <label className="recap-select-field">
                              <span className="sr-only">Varian harga {row.name}</span>
                              <select value={row.variantId ?? ""} onChange={(event) => selection({ variantId: event.target.value || null })}>
                                <option value="">Pilih varian</option>
                                {detail.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
                              </select>
                            </label>
                          )}
                        </div>
                      ) : (
                        <div className="recap-selection-stack">
                          <label className="recap-select-field">
                            <span className="sr-only">Katalog material {row.name}</span>
                            <select value={row.catalogId ?? ""} onChange={(event) => {
                              const nextId = event.target.value || null;
                              const nextDetail = nextId ? budgetDetails.get(nextId) : undefined;
                              const defaultVariant = nextDetail?.variants.find((variant) => variant.key === "brown") ?? nextDetail?.variants[0];
                              onSelectionChange(row.modelIndex, row.materialCode, { catalogId: nextId, variantId: defaultVariant?.id ?? null, componentId: null });
                            }}>
                              <option value="">Pilih katalog</option>
                              {budgetCatalogs.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                            </select>
                          </label>
                          {detail && detail.components.length > 0 && (
                            <label className="recap-select-field">
                              <span className="sr-only">Pilih item katalog untuk {row.name}</span>
                              <select value={row.componentId ?? ""} onChange={(event) => selection({
                                componentId: event.target.value || null,
                                variantId: detail.variants.length === 1 ? detail.variants[0].id : row.variantId,
                              })}>
                                <option value="">Pilih item katalog</option>
                                {detail.components.map((component) => <option key={component.id} value={component.id}>{componentLabel(component)}</option>)}
                              </select>
                            </label>
                          )}
                          {detail && detail.variants.length > 1 && (
                            <label className="recap-select-field">
                              <span className="sr-only">Varian harga {row.name}</span>
                              <select value={row.variantId ?? ""} onChange={(event) => selection({ variantId: event.target.value || null })}>
                                <option value="">Pilih varian harga</option>
                                {detail.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
                              </select>
                            </label>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <label className="price-field">
                        <span className="sr-only">Harga satuan {row.name} ({row.unit})</span>
                        <span className="price-prefix">Rp</span>
                        <input type="number" min="0" step="any" inputMode="decimal" placeholder="Isi harga" value={row.unitPrice ?? ""} onChange={(event) => {
                          if (event.target.value === "") onPriceChange(row.priceKey, undefined);
                          else onPriceChange(row.priceKey, Math.max(0, Number(event.target.value)));
                        }} />
                      </label>
                    </td>
                    <td className="recap-subtotal">{row.subtotal === null ? <span className="unpriced-label">Pilih spesifikasi</span> : formatRupiah(row.subtotal)}</td>
                  </tr>
                  {rows[rowIndex + 1]?.modelIndex !== row.modelIndex && modelLine && visibleExtraMaterials.filter((item) => item.modelLineId === modelLine.id).map((item) => {
                    const detail = item.catalogId ? budgetDetails.get(item.catalogId) : undefined;
                    const variant = detail?.variants.find((candidate) => candidate.id === item.variantId);
                    const modelQuantity = item.quantity * modelLine.modelCount;
                    const subtotal = item.unitPrice === null ? null : modelQuantity * item.unitPrice;
                    return (
                      <tr className="recap-extra-material-row" key={item.id}>
                        <td><span className="recap-material-name">{item.name}</span><small className="recap-material-code">Material tambahan · {item.unit}</small></td>
                        <td className="recap-quantity">
                          <input className="recap-extra-quantity" aria-label={"Qty per unit " + item.name} type="number" min="0.0001" step="any" value={item.quantity} onChange={(event) => onExtraMaterialsChange(extraMaterials.map((current) => current.id === item.id ? { ...current, quantity: Math.max(0.0001, Number(event.target.value) || 0.0001) } : current))} />
                          <small>{formatQuantity(item.quantity)} × {modelLine.modelCount} = {formatQuantity(modelQuantity)} {item.unit}</small>
                        </td>
                        <td><div className="recap-selection-stack"><span>{detail?.catalog.label ?? "Katalog"} · {variant?.label ?? "Varian belum dipilih"}</span></div></td>
                        <td>{item.unitPrice === null ? <span className="unpriced-label">Harga belum tersedia</span> : formatRupiah(item.unitPrice)}</td>
                        <td className="recap-subtotal">{subtotal === null ? "—" : formatRupiah(subtotal)} <button className="recap-extra-remove" type="button" aria-label={"Hapus " + item.name} onClick={() => onExtraMaterialsChange(extraMaterials.filter((current) => current.id !== item.id))}>×</button></td>
                      </tr>
                    );
                  })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {legacyExtraMaterials.length > 0 && (
        <section className="recap-extra-section recap-legacy-extra-section">
          <div className="recap-heading"><div><p className="eyebrow">DATA PROYEK LAMA</p><h3>Material tambahan belum terkait model</h3></div></div>
          <div className="recap-table-wrap"><table className="recap-table">
            <thead><tr><th>Material</th><th>Qty tersimpan</th><th>Katalog / varian</th><th>Harga satuan</th><th>Subtotal</th></tr></thead>
            <tbody>{legacyExtraMaterials.map((item) => {
              const detail = item.catalogId ? budgetDetails.get(item.catalogId) : undefined;
              const variant = detail?.variants.find((candidate) => candidate.id === item.variantId);
              const subtotal = item.unitPrice === null ? null : item.quantity * item.unitPrice;
              return <tr key={item.id}>
                <td>{item.name}<small className="recap-material-code">{item.unit}</small></td>
                <td>{formatQuantity(item.quantity)} {item.unit}</td>
                <td>{detail?.catalog.label ?? "—"} · {variant?.label ?? "—"}</td>
                <td>{item.unitPrice === null ? "—" : formatRupiah(item.unitPrice)}</td>
                <td className="recap-subtotal">{subtotal === null ? "—" : formatRupiah(subtotal)} <button className="recap-extra-remove" type="button" aria-label={"Hapus " + item.name} onClick={() => onExtraMaterialsChange(extraMaterials.filter((current) => current.id !== item.id))}>×</button></td>
              </tr>;
            })}</tbody>
          </table></div>
        </section>
      )}
      {pendingModelId && activeModelLine && (
        <div className="formula-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingModelId(null); }}>
          <section className="formula-create-modal recap-extra-modal" role="dialog" aria-modal="true" aria-labelledby="recap-extra-title">
            <p className="eyebrow">MATERIAL TAMBAHAN · MODEL {String(activeModelLine.modelIndex).padStart(2, "0")}</p>
            <h2 id="recap-extra-title">Tambah material untuk model {activeModelLine.modelCode}</h2>
            <p className="recap-extra-modal-description">Kebutuhan yang dimasukkan berlaku untuk satu unit model. Total akan mengikuti jumlah model pada proyek.</p>
            <div className="recap-extra-modal-fields">
              <label><span>Pilih katalog</span>
                <select value={selectedCatalogId} onChange={(event) => {
                  const catalogId = event.target.value;
                  const detail = catalogId ? budgetDetails.get(catalogId) : undefined;
                  setSelectedCatalogId(catalogId); setSelectedComponentId("");
                  setSelectedVariantId(detail?.variants.length === 1 ? detail.variants[0].id : "");
                }}>
                  <option value="">Pilih katalog</option>
                  {budgetCatalogs.map((catalog) => <option key={catalog.id} value={catalog.id}>{catalog.label}</option>)}
                </select>
              </label>
              <label><span>Pilih item katalog</span>
                <select value={selectedComponentId} disabled={!selectedCatalogDetail} onChange={(event) => {
                  setSelectedComponentId(event.target.value);
                  setSelectedVariantId(selectedCatalogDetail?.variants.length === 1 ? selectedCatalogDetail.variants[0].id : "");
                }}>
                  <option value="">Pilih item katalog</option>
                  {selectedCatalogDetail?.components.map((component) => <option key={component.id} value={component.id}>{componentLabel(component)}</option>)}
                </select>
              </label>
              <label><span>Pilih varian harga</span>
                <select value={selectedVariantId} disabled={!selectedComponent} onChange={(event) => setSelectedVariantId(event.target.value)}>
                  <option value="">Pilih varian harga</option>
                  {selectedCatalogDetail?.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
                </select>
              </label>
              <label><span>Kebutuhan per satu unit model</span>
                <div className="recap-extra-modal-quantity"><input type="number" min="0.0001" step="any" value={quantityPerModel} onChange={(event) => setQuantityPerModel(event.target.value)} /><span>{selectedComponent?.unit ?? "Satuan"}</span></div>
              </label>
            </div>
            {selectedComponent && selectedVariant && <div className="recap-extra-price-preview"><span>{selectedComponent.label} · {selectedVariant.label}</span><strong>{selectedPrice?.unitPrice == null ? "Harga belum tersedia" : formatRupiah(selectedPrice.unitPrice) + " / " + selectedComponent.unit}</strong></div>}
            <div className="formula-modal-actions formula-confirm-actions">
              <button className="secondary-button" type="button" onClick={() => setPendingModelId(null)}>Batal</button>
              <button className="primary-button" type="button" disabled={!selectedCatalogId || !selectedComponentId || !selectedVariantId || !Number.isFinite(Number(quantityPerModel)) || Number(quantityPerModel) <= 0} onClick={confirmAddMaterial}>Konfirmasi</button>
            </div>
          </section>
        </div>
      )}
      <div className="recap-total-row">
        <div><strong>Total sementara</strong>{missingPrices > 0 && <span>{missingPrices} harga satuan belum diisi</span>}</div>
        <strong className="grand-total">{formatRupiah(total)}</strong>
      </div>
    </section>
  );
}
