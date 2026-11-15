import { formatQuantity, formatRupiah } from "../../app/format";
import type { BudgetCatalog, BudgetCatalogDetail } from "../../domain/budgets/types";
import type { MaterialSelection } from "../projects/projectService";
import type { MaterialRecapRow } from "./aggregateMaterials";
import {
  aluminiumBrands,
  aluminiumFinishes,
  aluminiumVariantId,
  catalogForFamily,
  componentLabel,
  materialFamily,
  relatedMaterialComponents,
} from "./materialSelection";

type MaterialRecapProps = {
  rows: readonly MaterialRecapRow[];
  total: number;
  budgetCatalogs: readonly BudgetCatalog[];
  budgetDetails: ReadonlyMap<string, BudgetCatalogDetail>;
  onSelectionChange(materialCode: number, selection: MaterialSelection): void;
  onPriceChange(priceKey: string, unitPrice: number | undefined): void;
};

const familyLabels = {
  aluminium: "ALUMINIUM",
  glass: "KACA",
  accessory: "AKSESORIS",
  "door-leaf": "DAUN PINTU",
} as const;

export function MaterialRecap({ rows, total, budgetCatalogs, budgetDetails, onSelectionChange, onPriceChange }: MaterialRecapProps) {
  const missingPrices = rows.filter((row) => row.unitPrice === null).length;
  return (
    <section className="recap-card">
      <div className="recap-heading">
        <div><p className="eyebrow">RINGKASAN KEBUTUHAN</p><h2>Rekap material</h2></div>
        <span className="recap-count">{rows.length} item</span>
      </div>
      {rows.length === 0 ? (
        <div className="recap-empty"><span className="recap-empty-mark">↗</span><strong>Rekap akan muncul di sini</strong><p>Pilih model dan isi ukuran untuk melihat total bahan.</p></div>
      ) : (
        <div className="recap-table-wrap">
          <table className="recap-table">
            <thead><tr><th>Material</th><th>Kebutuhan</th><th>Pilihan material</th><th>Harga satuan</th><th>Jumlah</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const family = materialFamily(row.name, row.unit);
                const inferredCatalog = catalogForFamily(family, budgetCatalogs);
                const catalogId = inferredCatalog?.id ?? row.catalogId ?? "";
                const detail = catalogId ? budgetDetails.get(catalogId) : undefined;
                const selectedVariant = detail?.variants.find((variant) => variant.id === row.variantId);
                const components = relatedMaterialComponents(detail, family, row.name);
                const selection = (patch: Partial<MaterialSelection>) => onSelectionChange(row.materialCode, {
                  catalogId: catalogId || null,
                  variantId: row.variantId,
                  componentId: row.componentId,
                  ...patch,
                });

                return (
                  <tr key={`${row.materialCode}-${row.unit}-${row.priceKey}`}>
                    <td><span className="recap-material-name">{row.name}</span><small className="recap-material-code">{row.materialCode} · {row.unit}</small></td>
                    <td className="recap-quantity">{formatQuantity(row.quantity)} <span>{row.unit}</span></td>
                    <td>
                      {family === "aluminium" && detail ? (
                        <div className="recap-selection-stack">
                          <span className="recap-family-tag">ALUMINIUM</span>
                          <label className="recap-select-field">
                            <span className="sr-only">Ukuran profil kusen {row.name}</span>
                            <select value={row.componentId ?? ""} onChange={(event) => selection({ componentId: event.target.value || null })}>
                              <option value="">Pilih profil kusen</option>
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
                          <label className="recap-select-field">
                            <span className="sr-only">Varian atau merek {row.name}</span>
                            <select value={row.variantId ?? ""} disabled={!detail || detail.variants.length === 0} onChange={(event) => selection({ variantId: event.target.value || null })}>
                              <option value="">Pilih varian</option>
                              {(detail?.variants ?? []).map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
                            </select>
                          </label>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="recap-total-row">
        <div><strong>Total sementara</strong>{missingPrices > 0 && <span>{missingPrices} harga satuan belum diisi</span>}</div>
        <strong className="grand-total">{formatRupiah(total)}</strong>
      </div>
    </section>
  );
}
