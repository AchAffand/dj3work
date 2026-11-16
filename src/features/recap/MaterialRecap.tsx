import { Fragment } from "react";
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
  formulaOptionMaterialKey,
  parseFormulaOptionMaterialKey,
  supportsMultipleBudgetComponents,
} from "./materialSelection";

type MaterialRecapProps = {
  rows: readonly MaterialRecapRow[];
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

const familyLabels = {
  aluminium: "ALUMINIUM",
  glass: "KACA",
  accessory: "AKSESORIS",
  "door-leaf": "DAUN PINTU",
} as const;

export function MaterialRecap({ rows, total, budgetCatalogs, budgetDetails, onSelectionChange, onPriceChange, extraMaterials, onExtraMaterialsChange }: MaterialRecapProps) {
  const missingPrices = rows.filter((row) => !supportsMultipleBudgetComponents(row.name) && row.unitPrice === null).length
    + extraMaterials.filter((item) => item.unitPrice === null && item.componentId).length;
  const visibleExtraMaterials = extraMaterials.filter((item) =>
    !item.name.startsWith("__door_finish__:") && !item.name.startsWith("__formula_option__:"),
  );
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
                const family = materialFamily(row.name, row.unit);
                const inferredCatalog = catalogForFamily(family, budgetCatalogs);
                const catalogId = inferredCatalog?.id ?? row.catalogId ?? "";
                const detail = catalogId ? budgetDetails.get(catalogId) : undefined;
                const selectedVariant = detail?.variants.find((variant) => variant.id === row.variantId);
                const components = relatedMaterialComponents(detail, family, row.name);
                const multiSelectable = supportsMultipleBudgetComponents(row.name);
                const selectedFormulaOptions = extraMaterials.filter((item) => {
                  const option = parseFormulaOptionMaterialKey(item.name);
                  return option?.modelIndex === row.modelIndex && option.materialCode === row.materialCode;
                });
                const selectedFormulaOptionIds = new Set(selectedFormulaOptions.flatMap((item) => {
                  const option = parseFormulaOptionMaterialKey(item.name);
                  return option ? [option.componentId] : [];
                }));
                const selectedFormulaSubtotal = selectedFormulaOptions.reduce((sum, item) => sum + (item.unitPrice === null ? 0 : item.quantity * item.unitPrice), 0);
                const selectedFormulaHasMissingPrice = selectedFormulaOptions.some((item) => item.unitPrice === null);
                const selection = (patch: Partial<MaterialSelection>) => onSelectionChange(row.modelIndex, row.materialCode, {
                  catalogId: catalogId || null,
                  variantId: row.variantId,
                  componentId: row.componentId,
                  ...patch,
                });
                const toggleFormulaOption = (componentId: string, checked: boolean) => {
                  const selected = new Set(selectedFormulaOptionIds);
                  if (checked) selected.add(componentId);
                  else selected.delete(componentId);
                  const retained = extraMaterials.filter((item) => {
                    const option = parseFormulaOptionMaterialKey(item.name);
                    return !option || option.modelIndex !== row.modelIndex || option.materialCode !== row.materialCode;
                  });
                  const existingByComponent = new Map(selectedFormulaOptions.flatMap((item) => {
                    const option = parseFormulaOptionMaterialKey(item.name);
                    return option ? [[option.componentId, item] as const] : [];
                  }));
                  const nextOptions = components.filter((component) => selected.has(component.id)).map((component) => {
                    const existing = existingByComponent.get(component.id);
                    return {
                      id: existing?.id ?? createMaterialId(),
                      name: formulaOptionMaterialKey(row.modelIndex, row.materialCode, component.id),
                      unit: component.unit,
                      quantity: row.quantity,
                      catalogId: detail?.catalog.id ?? catalogId,
                      variantId: row.variantId ?? (detail?.variants.length === 1 ? detail.variants[0].id : null),
                      componentId: component.id,
                      unitPrice: existing?.unitPrice ?? null,
                      priceVersion: existing?.priceVersion ?? null,
                      expressionSnapshot: existing?.expressionSnapshot ?? null,
                    };
                  });
                  onExtraMaterialsChange([...retained, ...nextOptions]);
                };

                return (
                  <Fragment key={`${row.modelIndex}-${row.materialCode}-${row.unit}-${row.priceKey}`}>
                    {row.modelIndex !== previousRow?.modelIndex && <tr className="recap-model-divider"><td colSpan={5}><div className="recap-model-heading"><span className="recap-model-number">{String(row.modelIndex).padStart(2, "0")}</span><span className="recap-model-label">Model</span><span className="recap-model-name">- {row.modelCode ?? "—"} ({row.modelName ?? "Nama model tidak tersedia"})</span><span className="recap-model-rule" /></div></td></tr>}
                    <tr>
                    <td><span className="recap-material-name">{row.name}</span><small className="recap-material-code">{row.materialCode} · {row.unit}</small></td>
                    <td className="recap-quantity">{formatQuantity(row.quantity)} <span>{row.unit}</span></td>
                    <td>
                      {family === "aluminium" && detail ? (
                        <div className="recap-selection-stack">
                          <span className="recap-family-tag">ALUMINIUM</span>
                          {multiSelectable ? (
                            <div className="recap-component-options" role="group" aria-label={`Pilihan item untuk ${row.name}`}>
                              <span className="recap-component-options-hint">Pilih satu atau beberapa item</span>
                              {components.map((component) => (
                                <label className="recap-component-option" key={component.id}>
                                  <input type="checkbox" checked={selectedFormulaOptionIds.has(component.id)} onChange={(event) => toggleFormulaOption(component.id, event.target.checked)} />
                                  <span>{componentLabel(component)}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <label className="recap-select-field">
                              <span className="sr-only">{/\bkusen\b/i.test(row.name) ? "Ukuran profil kusen" : "Komponen aluminium"} {row.name}</span>
                              <select value={row.componentId ?? ""} onChange={(event) => selection({ componentId: event.target.value || null })}>
                                <option value="">{/\bkusen\b/i.test(row.name) ? "Pilih profil kusen" : "Pilih komponen aluminium"}</option>
                                {components.map((component) => <option key={component.id} value={component.id}>{componentLabel(component)}</option>)}
                              </select>
                            </label>
                          )}
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
                          {multiSelectable ? (
                            <div className="recap-component-options" role="group" aria-label={`Pilihan item untuk ${row.name}`}>
                              <span className="recap-component-options-hint">Pilih satu atau beberapa item</span>
                              {components.map((component) => (
                                <label className="recap-component-option" key={component.id}>
                                  <input type="checkbox" checked={selectedFormulaOptionIds.has(component.id)} onChange={(event) => toggleFormulaOption(component.id, event.target.checked)} />
                                  <span>{componentLabel(component)}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <label className="recap-select-field">
                              <span className="sr-only">Pilih jenis {row.name}</span>
                              <select value={row.componentId ?? ""} onChange={(event) => selection({ componentId: event.target.value || null })}>
                                <option value="">Pilih jenis material</option>
                                {components.map((component) => <option key={component.id} value={component.id}>{componentLabel(component)}</option>)}
                              </select>
                            </label>
                          )}
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
                              onSelectionChange(row.materialCode, { catalogId: nextId, variantId: defaultVariant?.id ?? null, componentId: null });
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
                      {multiSelectable ? (
                        <div className="recap-selected-component-prices">
                          {selectedFormulaOptions.length ? selectedFormulaOptions.map((item) => {
                            const component = detail?.components.find((candidate) => candidate.id === item.componentId);
                            return <small key={item.id}>{component ? componentLabel(component) : "Item terpilih"} · {item.unitPrice === null ? "Harga belum diisi" : formatRupiah(item.unitPrice)}</small>;
                          }) : <span className="unpriced-label">Pilih item</span>}
                        </div>
                      ) : (
                        <label className="price-field">
                          <span className="sr-only">Harga satuan {row.name} ({row.unit})</span>
                          <span className="price-prefix">Rp</span>
                          <input type="number" min="0" step="any" inputMode="decimal" placeholder="Isi harga" value={row.unitPrice ?? ""} onChange={(event) => {
                            if (event.target.value === "") onPriceChange(row.priceKey, undefined);
                            else onPriceChange(row.priceKey, Math.max(0, Number(event.target.value)));
                          }} />
                        </label>
                      )}
                    </td>
                    <td className="recap-subtotal">{multiSelectable
                      ? selectedFormulaOptions.length === 0
                        ? <span className="unpriced-label">Pilih item</span>
                        : selectedFormulaHasMissingPrice
                          ? <span className="unpriced-label">Harga belum lengkap</span>
                          : formatRupiah(selectedFormulaSubtotal)
                      : row.subtotal === null ? <span className="unpriced-label">Pilih spesifikasi</span> : formatRupiah(row.subtotal)}</td>
                  </tr>

                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <section className="recap-extra-section">
        <div className="recap-heading">
          <div><p className="eyebrow">KEBUTUHAN TAMBAHAN</p><h3>Material tambahan</h3></div>
          <button className="secondary-button" type="button" onClick={() => onExtraMaterialsChange([...extraMaterials, {
            id: createMaterialId(),
            name: "", unit: "", quantity: 1, catalogId: null, variantId: null, componentId: null, unitPrice: null,
          }])}>＋ Tambah material</button>
        </div>
        {visibleExtraMaterials.length > 0 && (
          <div className="recap-table-wrap">
            <table className="recap-table">
              <thead><tr><th>Kelompok & material</th><th>Qty</th><th>Varian</th><th>Harga satuan</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {visibleExtraMaterials.map((item) => {
                  const detail = item.catalogId ? budgetDetails.get(item.catalogId) : undefined;
                  const selectedComponent = detail?.components.find((component) => component.id === item.componentId);
                  const selectedVariant = detail?.variants.find((variant) => variant.id === item.variantId);
                  const update = (patch: Partial<ProjectExtraMaterial>) => onExtraMaterialsChange(extraMaterials.map((current) => current.id === item.id ? { ...current, ...patch } : current));
                  const subtotal = item.unitPrice === null ? null : item.quantity * item.unitPrice;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="recap-selection-stack">
                          <label className="recap-select-field">
                            <span className="sr-only">Kelompok material tambahan</span>
                            <select value={detail?.catalog.slug ?? ""} onChange={(event) => {
                              const slug = event.target.value;
                              const catalog = budgetCatalogs.find((candidate) => candidate.slug === slug);
                              const nextDetail = catalog ? budgetDetails.get(catalog.id) : undefined;
                              update({ catalogId: catalog?.id ?? null, variantId: nextDetail?.variants.length === 1 ? nextDetail.variants[0].id : null, componentId: null, name: "", unit: "", unitPrice: null });
                            }}>
                              <option value="">Pilih kelompok</option>
                              <option value="almunium">Aluminium</option>
                              <option value="kaca">Kaca</option>
                              <option value="ass">Aksesori</option>
                              <option value="daun-pintu">Daun pintu</option>
                            </select>
                          </label>
                          {detail && (
                            <label className="recap-select-field">
                              <span className="sr-only">Pilih komponen tambahan</span>
                              <select value={item.componentId ?? ""} onChange={(event) => {
                                const component = detail.components.find((candidate) => candidate.id === event.target.value);
                                update({ componentId: component?.id ?? null, name: component?.label ?? "", unit: component?.unit ?? "", unitPrice: null });
                              }}>
                                <option value="">Pilih item</option>
                                {detail.components.map((component) => <option key={component.id} value={component.id}>{componentLabel(component)}</option>)}
                              </select>
                            </label>
                          )}
                          {selectedComponent && <small>{selectedComponent.category} · {selectedComponent.unit}</small>}
                        </div>
                      </td>
                      <td><input className="recap-extra-quantity" type="number" min="0.0001" step="any" value={item.quantity} onChange={(event) => update({ quantity: Math.max(0.0001, Number(event.target.value) || 0.0001) })} /></td>
                      <td>
                        {detail && detail.variants.length > 1 ? (
                          <select value={item.variantId ?? ""} onChange={(event) => update({ variantId: event.target.value || null, unitPrice: null })}>
                            <option value="">Pilih varian</option>
                            {detail.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
                          </select>
                        ) : <span>{selectedVariant?.label ?? (detail?.variants.length === 1 ? detail.variants[0].label : "—")}</span>}
                      </td>
                      <td>{item.unitPrice === null ? <span className="unpriced-label">Pilih spesifikasi</span> : formatRupiah(item.unitPrice)}</td>
                      <td className="recap-subtotal">{subtotal === null ? "—" : formatRupiah(subtotal)}</td>
                      <td><button className="secondary-button" type="button" aria-label={`Hapus ${item.name || "material tambahan"}`} onClick={() => onExtraMaterialsChange(extraMaterials.filter((current) => current.id !== item.id))}>Hapus</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="recap-total-row">
        <div><strong>Total sementara</strong>{missingPrices > 0 && <span>{missingPrices} harga satuan belum diisi</span>}</div>
        <strong className="grand-total">{formatRupiah(total)}</strong>
      </div>
    </section>
  );
}
