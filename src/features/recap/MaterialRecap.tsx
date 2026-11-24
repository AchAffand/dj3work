import { Fragment, useEffect, useState } from "react";
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
  modelLines: { id: string; modelIndex: number; modelCode: number; modelName: string; modelCount: number; formulaMaterials?: { code: number; name: string; unit: string; quantity?: number; error?: string }[] }[];
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

type FormulaMaterialChoice = { code: number; name: string; unit: string; quantity?: number; error?: string; score: number };

function normalizeFormulaMatch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("id-ID")
    .replace(/tempered/g, "temp")
    .replace(/spandrell?/g, "spandrel")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function formulaChoicesForComponent(
  component: { label: string; category: string },
  materials: { code: number; name: string; unit: string; quantity?: number; error?: string }[],
): FormulaMaterialChoice[] {
  const stopWords = new Set(["dan", "atau", "untuk", "material", "profil", "warna", "finishing", "aluminium", "almunium"]);
  const words = normalizeFormulaMatch(component.label).split(" ").filter((word) => word.length > 1 && !stopWords.has(word));
  const category = normalizeFormulaMatch(component.category);
  return materials.map((material) => {
    const materialWords = normalizeFormulaMatch(material.name).split(" ");
    const score = words.reduce((sum, word) => sum + (materialWords.includes(word) ? 1 : 0), 0);
    const categoryMatch = category === "kaca" && materialWords.includes("kaca");
    return { ...material, score: score + (categoryMatch ? 0.25 : 0) };
  }).filter((material) => material.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
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
  const [selectedFormulaMaterialCode, setSelectedFormulaMaterialCode] = useState("");
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualModelId, setManualModelId] = useState<string | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualQuantity, setManualQuantity] = useState("1");
  const [manualUnitPrice, setManualUnitPrice] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!successMessage) return;
    const timeoutId = window.setTimeout(() => setSuccessMessage(""), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);
  const missingPrices = rows.filter((row) => row.unitPrice === null).length
    + extraMaterials.filter((item) => item.unitPrice === null).length;
  const visibleExtraMaterials = extraMaterials.filter((item) =>
    !item.name.startsWith("__door_finish__:") && !item.name.startsWith("__formula_option__:"),
  );
  const legacyExtraMaterials = visibleExtraMaterials.filter((item) => !item.modelLineId);
  const activeModelLine = modelLines.find((line) => line.id === pendingModelId);
  const selectedCatalogDetail = selectedCatalogId ? budgetDetails.get(selectedCatalogId) : undefined;
  const selectedComponent = selectedCatalogDetail?.components.find((item) => item.id === selectedComponentId);
  const selectedVariant = selectedCatalogDetail?.variants.find((item) => item.id === selectedVariantId);
  const formulaChoices = selectedComponent && activeModelLine
    ? formulaChoicesForComponent(selectedComponent, activeModelLine.formulaMaterials ?? [])
    : [];
  const topFormulaChoice = formulaChoices.length > 1 && formulaChoices[0].score > formulaChoices[1].score
    ? formulaChoices[0]
    : formulaChoices.length === 1 ? formulaChoices[0] : undefined;
  const selectedFormulaMaterial = formulaChoices.find((item) => String(item.code) === selectedFormulaMaterialCode) ?? topFormulaChoice;
  const formulaQuantity = selectedFormulaMaterial?.quantity;
  const formulaQuantityReady = Boolean(selectedFormulaMaterial && typeof formulaQuantity === "number" && Number.isFinite(formulaQuantity));
  const selectedPrice = selectedComponent && selectedVariantId
    ? budgetPriceForMaterial(selectedCatalogDetail, -999999, selectedComponent.label, selectedComponent.unit, selectedVariantId, null, null, null, null, null, selectedComponent.id)
    : null;
  const openAddMaterial = (modelLineId: string) => {
    setSelectedCatalogId(""); setSelectedComponentId(""); setSelectedVariantId(""); setQuantityPerModel("1"); setSelectedFormulaMaterialCode("");
    setPendingModelId(modelLineId);
  };
  const openAddManualMaterial = (modelLineId: string) => {
    setManualName(""); setManualQuantity("1"); setManualUnitPrice("");
    setManualModelId(modelLineId); setManualModalOpen(true);
  };
  const confirmAddManualMaterial = () => {
    const modelLine = modelLines.find((line) => line.id === manualModelId);
    const name = manualName.trim();
    const quantity = Number(manualQuantity);
    const unitPrice = Number(manualUnitPrice);
    if (!modelLine || !name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return;
    onExtraMaterialsChange([...extraMaterials, {
      id: createMaterialId(), modelLineId: modelLine.id, formulaMaterialCode: null,
      name, unit: "unit", quantity, catalogId: null, variantId: null, componentId: null,
      unitPrice,
    }]);
    setManualName(""); setManualQuantity("1"); setManualUnitPrice(""); setManualModalOpen(false); setManualModelId(null);
    setSuccessMessage(`Material “${name}” berhasil ditambahkan ke Model ${String(modelLine.modelIndex).padStart(2, "0")}.`);
  };
  const confirmAddMaterial = () => {
    if (!activeModelLine || !selectedCatalogDetail || !selectedComponent || !selectedVariantId) return;
    const quantity = selectedFormulaMaterial
      ? formulaQuantityReady ? formulaQuantity! : NaN
      : Number(quantityPerModel);
    if (!Number.isFinite(quantity) || quantity < 0 || (!selectedFormulaMaterial && quantity === 0)) return;
    onExtraMaterialsChange([...extraMaterials, {
      id: createMaterialId(), modelLineId: activeModelLine.id,
      formulaMaterialCode: selectedFormulaMaterial?.code ?? null,
      name: selectedComponent.label,
      unit: selectedFormulaMaterial?.unit ?? selectedComponent.unit, quantity, catalogId: selectedCatalogDetail.catalog.id,
      variantId: selectedVariantId, componentId: selectedComponent.id,
      unitPrice: selectedPrice?.unitPrice ?? null, priceVersion: selectedPrice?.priceVersion ?? null,
      expressionSnapshot: selectedPrice?.expressionSnapshot ?? null,
    }]);
    setPendingModelId(null);
    setSuccessMessage(`Material “${selectedComponent.label}” berhasil ditambahkan ke Model ${String(activeModelLine.modelIndex).padStart(2, "0")}.`);
  };
  return (
    <section className="recap-card">
      {successMessage && <div className="formula-toast success" role="status" aria-live="polite"><span className="formula-toast-icon" aria-hidden="true">✓</span><div className="formula-toast-copy"><strong>Material berhasil ditambahkan</strong><span>{successMessage}</span></div><button className="formula-toast-close" type="button" aria-label="Tutup notifikasi" onClick={() => setSuccessMessage("")}>×</button></div>}
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
                    {row.modelIndex !== previousRow?.modelIndex && <tr className="recap-model-divider"><td colSpan={5}><div className="recap-model-heading"><span className="recap-model-number">{String(row.modelIndex).padStart(2, "0")}</span><span className="recap-model-label">Model</span><span className="recap-model-name">- {row.modelCode ?? "—"} ({row.modelName ?? "Nama model tidak tersedia"})</span><span className="recap-model-rule" />{modelLine && <div className="recap-model-actions"><button className="secondary-button recap-add-model-material" type="button" onClick={() => openAddMaterial(modelLine.id)}>＋ Tambah dari katalog</button><button className="secondary-button recap-add-model-material" type="button" onClick={() => openAddManualMaterial(modelLine.id)}>＋ Material manual</button></div>}</div></td></tr>}
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
                        <td>{!item.catalogId && !item.componentId && !item.formulaMaterialCode
                          ? <input className="recap-manual-name" aria-label={"Nama item " + item.name} type="text" value={item.name} onChange={(event) => onExtraMaterialsChange(extraMaterials.map((current) => current.id === item.id ? { ...current, name: event.target.value } : current))} />
                          : <span className="recap-material-name">{item.name}</span>}<small className="recap-material-code">Material tambahan · {item.unit}</small></td>
                        <td className="recap-quantity">
                          <input className="recap-extra-quantity" aria-label={"Qty per unit " + item.name} type="number" min="0.0001" step="any" readOnly={Boolean(item.formulaMaterialCode)} value={item.quantity} onChange={(event) => onExtraMaterialsChange(extraMaterials.map((current) => current.id === item.id ? { ...current, quantity: Math.max(0.0001, Number(event.target.value) || 0.0001) } : current))} />
                          <small>{item.formulaMaterialCode ? "Mengikuti rumus model" : "Qty manual"} · {formatQuantity(item.quantity)} × {modelLine.modelCount} = {formatQuantity(modelQuantity)} {item.unit}</small>
                        </td>
                        <td><div className="recap-selection-stack"><span>{detail?.catalog.label ?? "Katalog"} · {variant?.label ?? "Varian belum dipilih"}</span></div></td>
                        <td>{!item.catalogId && !item.componentId && !item.formulaMaterialCode
                          ? <label className="price-field"><span className="price-prefix">Rp</span><input aria-label={"Harga satuan " + item.name} type="number" min="0" step="any" value={item.unitPrice ?? ""} onChange={(event) => onExtraMaterialsChange(extraMaterials.map((current) => current.id === item.id ? { ...current, unitPrice: event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0) } : current))} /></label>
                          : item.unitPrice === null ? <span className="unpriced-label">Harga belum tersedia</span> : formatRupiah(item.unitPrice)}</td>
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
          <div className="recap-heading"><div><p className="eyebrow">INPUT MANUAL</p><h3>Material tambahan proyek</h3></div></div>
          <div className="recap-table-wrap"><table className="recap-table">
            <thead><tr><th>Nama item</th><th>Qty proyek</th><th>Harga satuan</th><th>Subtotal</th></tr></thead>
            <tbody>{legacyExtraMaterials.map((item) => {
              const subtotal = item.unitPrice === null ? null : item.quantity * item.unitPrice;
              const updateItem = (patch: Partial<ProjectExtraMaterial>) => onExtraMaterialsChange(extraMaterials.map((current) => current.id === item.id ? { ...current, ...patch } : current));
              return <tr key={item.id}>
                <td><input className="recap-manual-name" aria-label={"Nama item " + item.name} type="text" value={item.name} onChange={(event) => updateItem({ name: event.target.value })} /></td>
                <td><input className="recap-extra-quantity" aria-label={"Qty proyek " + item.name} type="number" min="0.0001" step="any" value={item.quantity} onChange={(event) => updateItem({ quantity: Math.max(0.0001, Number(event.target.value) || 0.0001) })} /></td>
                <td><label className="price-field"><span className="price-prefix">Rp</span><input aria-label={"Harga satuan " + item.name} type="number" min="0" step="any" value={item.unitPrice ?? ""} onChange={(event) => updateItem({ unitPrice: event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0) })} /></label></td>
                <td className="recap-subtotal">{subtotal === null ? "—" : formatRupiah(subtotal)} <button className="recap-extra-remove" type="button" aria-label={"Hapus " + item.name} onClick={() => onExtraMaterialsChange(extraMaterials.filter((current) => current.id !== item.id))}>×</button></td>
              </tr>;
            })}</tbody>
          </table></div>
        </section>
      )}
      {manualModalOpen && (
        <div className="formula-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setManualModalOpen(false); setManualModelId(null); } }}>
          <section className="formula-create-modal recap-extra-modal" role="dialog" aria-modal="true" aria-labelledby="manual-extra-title">
            <p className="eyebrow">MATERIAL TAMBAHAN · INPUT MANUAL</p>
            <h2 id="manual-extra-title">Tambah material untuk model {String(modelLines.find((line) => line.id === manualModelId)?.modelIndex ?? "").padStart(2, "0")}</h2>
            <p className="recap-extra-modal-description">Qty berlaku untuk satu unit model dan otomatis dikalikan jumlah model pada proyek.</p>
            <div className="recap-extra-modal-fields">
              <label><span>1. Nama Item</span><input autoFocus type="text" maxLength={120} placeholder="Contoh: Baut, sealant, ongkos pasang" value={manualName} onChange={(event) => setManualName(event.target.value)} /></label>
              <label><span>2. Qty</span><input type="number" min="0.0001" step="any" placeholder="Masukkan qty per satu unit model" value={manualQuantity} onChange={(event) => setManualQuantity(event.target.value)} /></label>
              <label><span>3. Harga Satuan</span><div className="recap-extra-modal-quantity recap-extra-modal-price"><span>Rp</span><input type="number" min="0" step="any" placeholder="Masukkan harga satuan" value={manualUnitPrice} onChange={(event) => setManualUnitPrice(event.target.value)} /></div></label>
            </div>
            <div className="formula-modal-actions formula-confirm-actions">
              <button className="secondary-button" type="button" onClick={() => setManualModalOpen(false)}>Batal</button>
              <button className="primary-button" type="button" disabled={!manualName.trim() || !Number.isFinite(Number(manualQuantity)) || Number(manualQuantity) <= 0 || manualUnitPrice === "" || !Number.isFinite(Number(manualUnitPrice)) || Number(manualUnitPrice) < 0} onClick={confirmAddManualMaterial}>Tambahkan</button>
            </div>
          </section>
        </div>
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
                  setSelectedFormulaMaterialCode("");
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
              {formulaChoices.length > 1 && (
                <label><span>Sumber rumus model</span>
                  <select value={selectedFormulaMaterial ? String(selectedFormulaMaterial.code) : selectedFormulaMaterialCode} onChange={(event) => setSelectedFormulaMaterialCode(event.target.value)}>
                    <option value="">Pilih sumber rumus</option>
                    {formulaChoices.map((material) => <option key={material.code} value={material.code}>{material.name} · {material.code}</option>)}
                  </select>
                </label>
              )}
              <label><span>Kebutuhan per satu unit model</span>
                {selectedFormulaMaterial ? (
                  <div className="recap-extra-modal-quantity">
                    <input type="number" readOnly value={formulaQuantityReady ? String(formulaQuantity) : ""} placeholder={selectedFormulaMaterial.error ?? "Lengkapi ukuran model"} />
                    <span>{selectedFormulaMaterial.unit}</span>
                  </div>
                ) : (
                  <div className="recap-extra-modal-quantity"><input type="number" min="0.0001" step="any" value={quantityPerModel} onChange={(event) => setQuantityPerModel(event.target.value)} /><span>{selectedComponent?.unit ?? "Satuan"}</span></div>
                )}
                {selectedFormulaMaterial && <small className="recap-extra-formula-note">Mengikuti rumus {selectedFormulaMaterial.name} pada Model {activeModelLine.modelCode}. Qty akan dihitung ulang saat ukuran model berubah.</small>}
              </label>
            </div>
            {selectedComponent && selectedVariant && <div className="recap-extra-price-preview"><span>{selectedComponent.label} · {selectedVariant.label}</span><strong>{selectedPrice?.unitPrice == null ? "Harga belum tersedia" : formatRupiah(selectedPrice.unitPrice) + " / " + selectedComponent.unit}</strong></div>}
            <div className="formula-modal-actions formula-confirm-actions">
              <button className="secondary-button" type="button" onClick={() => setPendingModelId(null)}>Batal</button>
              <button className="primary-button" type="button" disabled={!selectedCatalogId || !selectedComponentId || !selectedVariantId || (selectedFormulaMaterial ? !formulaQuantityReady || formulaQuantity! < 0 : !Number.isFinite(Number(quantityPerModel)) || Number(quantityPerModel) <= 0) || (formulaChoices.length > 1 && !selectedFormulaMaterial)} onClick={confirmAddMaterial}>Konfirmasi</button>
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
