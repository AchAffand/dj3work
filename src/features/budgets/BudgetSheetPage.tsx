import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppPageState } from "../../app/AppPageState";
import { formatRupiah } from "../../app/format";
import { useAppServices } from "../../app/AppServices";
import type { BudgetCatalog, BudgetCatalogDetail, BudgetComponent } from "../../domain/budgets/types";
import { validateBudgetPriceFormula } from "../../domain/budgets/priceFormula";
import { calculateExpression } from "../../domain/formulas/evaluate";

type ComponentDraft = { id?: string; key?: string; label: string; unit: string; groupLabel: string };
type PriceDraft = { componentId: string; variantKey: string; amount: string; expression: string };
type GroupDraft = { id?: string; name: string };

const brandOf = (label: string) => label.split(" · ")[0] ?? label;
const finishOf = (label: string) => label.includes(" · ") ? label.split(" · ").slice(1).join(" · ") : label;

export function BudgetSheetPage() {
  const { repository, isCatalogAdmin, reloadBudgets } = useAppServices();
  const { catalogSlug = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<BudgetCatalogDetail | null>(null);
  const [catalogs, setCatalogs] = useState<BudgetCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [componentDraft, setComponentDraft] = useState<ComponentDraft | null>(null);
  const [priceDraft, setPriceDraft] = useState<PriceDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetComponent | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);
  const [groupSelectionMode, setGroupSelectionMode] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [confirmGroupDelete, setConfirmGroupDelete] = useState(false);

  const load = useCallback(async () => {
    if (!repository) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [loaded, available] = await Promise.all([
        repository.loadBudgetCatalog(catalogSlug),
        repository.listBudgetCatalogs(),
      ]);
      if (!loaded) throw new Error("Lembar Excel tidak ditemukan.");
      setDetail(loaded);
      setCatalogs(available);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Master harga gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [repository, catalogSlug]);

  useEffect(() => { void load(); }, [load]);

  const sections = useMemo(() => {
    if (!detail) return [];
    const ordered: [string, BudgetComponent[]][] = detail.groups.map((group) => [
      group.name, detail.components.filter((component) => component.groupLabel?.trim() === group.name),
    ]);
    const known = new Set(detail.groups.map((group) => group.name));
    const ungrouped = detail.components.filter((component) => !component.groupLabel?.trim() || !known.has(component.groupLabel.trim()));
    if (ungrouped.length) ordered.push([detail.catalog.label, ungrouped]);
    return ordered;
  }, [detail]);

  const savePrice = async () => {
    if (!repository || !detail || !priceDraft) return;
    const amount = priceDraft.amount.trim() ? Number(priceDraft.amount.replaceAll(",", "")) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      setMessage("Harga harus berupa angka nol atau lebih.");
      return;
    }
    if (amount === null && !priceDraft.expression.trim()) {
      setMessage("Isi harga angka atau rumus.");
      return;
    }
    if (priceDraft.expression.trim()) {
      try {
        const variables = Object.fromEntries(detail.components.flatMap((component) => detail.variants.flatMap((variant) => {
          const price = component.prices[variant.key];
          const value = price?.amount ?? (price?.expression ? calculateExpression(price.expression, {}) : null);
          return value === null ? [] : [["price_" + component.key + "_" + variant.key, value] as const];
        })));
        const validation = validateBudgetPriceFormula(priceDraft.expression, Object.entries(variables).map(([key, value]) => ({ key, value })));
        if (validation.error) { setMessage(validation.error); return; }
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : "Rumus harga tidak valid.");
        return;
      }
    }
    setSaving(true);
    setMessage(null);
    try {
      const variant = detail.variants.find((item) => item.key === priceDraft.variantKey);
      if (!variant) throw new Error("Kolom harga tidak ditemukan.");
      const version = await repository.saveBudgetPriceChange(
        priceDraft.componentId,
        variant.id,
        amount,
        priceDraft.expression.trim() || null,
      );
      setDetail((current) => current ? ({
        ...current,
        components: current.components.map((component) => component.id === priceDraft.componentId
          ? { ...component, prices: { ...component.prices, [priceDraft.variantKey]: { amount, expression: priceDraft.expression.trim() || null, version } } }
          : component),
      }) : current);
      setPriceDraft(null);
      setMessage("Harga berhasil disimpan.");
      void reloadBudgets?.();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Harga gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const saveComponent = async () => {
    if (!repository || !detail || !componentDraft) return;
    if (!componentDraft.label.trim() || !componentDraft.groupLabel) {
      setMessage("Nama item dan bagian lembar Excel wajib diisi.");
      return;
    }
    const sample = detail.components.find((item) => item.groupLabel === componentDraft.groupLabel);
    setSaving(true);
    setMessage(null);
    try {
      await repository.saveBudgetComponent({
        ...componentDraft,
        key: componentDraft.key ?? `manual_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
        catalogId: detail.catalog.id,
        category: sample?.category ?? detail.catalog.label,
      });
      setComponentDraft(null);
      await load();
      await reloadBudgets?.();
      setMessage("Item berhasil disimpan.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Item gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const saveGroup = async () => {
    if (!repository || !detail || !groupDraft) return;
    const name = groupDraft.name.trim();
    if (!name) { setMessage("Nama kelompok wajib diisi."); return; }
    setSaving(true); setMessage(null);
    try {
      if (groupDraft.id) await repository.renameBudgetComponentGroup(detail.catalog.id, groupDraft.id, name);
      else await repository.createBudgetComponentGroup(detail.catalog.id, name);
      setGroupDraft(null);
      await load(); await reloadBudgets?.();
      setMessage(groupDraft.id ? "Nama kelompok berhasil diperbarui." : "Kelompok baru berhasil dibuat.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Kelompok gagal disimpan.");
    } finally { setSaving(false); }
  };

  const deleteSelectedGroups = async () => {
    if (!repository || !detail || selectedGroupIds.length === 0) return;
    setSaving(true); setMessage(null);
    try {
      const deletedItems = await repository.deleteBudgetComponentGroups(detail.catalog.id, selectedGroupIds);
      const deletedGroups = selectedGroupIds.length;
      setSelectedGroupIds([]); setConfirmGroupDelete(false); setGroupSelectionMode(false);
      await load(); await reloadBudgets?.();
      setMessage(`${deletedGroups} kelompok dan ${deletedItems} item beserta harga terkait berhasil dihapus permanen dari database.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Kelompok gagal dihapus.");
    } finally { setSaving(false); }
  };

  const archiveComponent = async () => {
    if (!repository || !detail || !deleteTarget) return;
    setSaving(true);
    setMessage(null);
    try {
      await repository.archiveBudgetComponent(detail.catalog.id, deleteTarget.id);
      setDeleteTarget(null);
      await load();
      await reloadBudgets?.();
      setMessage("Item dikeluarkan dari daftar aktif.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Item gagal dihapus.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppPageState title="Membuka lembar harga" detail="Menyiapkan data seperti workbook Excel." />;
  if (error || !detail) return <AppPageState title="Lembar harga belum dapat dibuka" detail={error ?? "Data tidak tersedia."} tone="error" actionLabel="Coba lagi" onAction={() => void load()} />;

  const variantsByBrand = [...new Map(detail.variants.map((variant) => [brandOf(variant.label), detail.variants.filter((item) => brandOf(item.label) === brandOf(variant.label))])).entries()];
  const groupedHeaders = detail.variants.length > 1 && variantsByBrand.some(([, variants]) => variants.length > 1);

  return (
    <section className="page-content budget-page budget-sheet-page">
      <div className="budget-sheet-heading">
        <div>
          <p className="eyebrow">MASTER BUDGET KUSEN 2026</p>
          <h1>{detail.catalog.label}</h1>
          <p className="page-description">Lembar harga mengikuti susunan workbook Excel. Klik sel harga untuk mengubah nilainya.</p>
        </div>
        {isCatalogAdmin && <div className="budget-group-toolbar">
          <button className="budget-group-button budget-group-create" type="button" onClick={() => setGroupDraft({ name: "" })}><span>＋</span> BUAT KELOMPOK BARU</button>
          <button className={`budget-group-button budget-group-delete ${groupSelectionMode ? "is-active" : ""}`} type="button" onClick={() => {
            if (groupSelectionMode && selectedGroupIds.length) setConfirmGroupDelete(true);
            else { setGroupSelectionMode(!groupSelectionMode); setSelectedGroupIds([]); }
          }}>{groupSelectionMode && selectedGroupIds.length ? `HAPUS (${selectedGroupIds.length})` : groupSelectionMode ? "BATAL HAPUS" : "HAPUS KELOMPOK"}</button>
          <button className="primary-button" type="button" onClick={() => {
            setComponentDraft({ label: "", unit: "pcs", groupLabel: sections[0]?.[0] ?? "" });
            setMessage(null);
          }}>+ Tambah item</button>
        </div>}
      </div>

      <nav className="budget-sheet-tabs" aria-label="Lembar workbook">
        {catalogs.map((catalog) => (
          <button key={catalog.id} type="button" className={catalog.id === detail.catalog.id ? "active" : ""} onClick={() => navigate(`/master-harga/${catalog.slug}`)}>
            {catalog.label}
          </button>
        ))}
      </nav>

      {message && <div className="notice-banner" role="status">{message}</div>}
      {!isCatalogAdmin && <div className="notice-banner">Mode lihat saja. Perubahan harga dan item memerlukan akses admin.</div>}

      <div className="budget-sheet-meta">
        <span>{detail.components.length} item</span>
        <span>{detail.variants.length} kolom harga</span>
        <span>Data sumber: Master budget kusen 2026.xlsx</span>
      </div>

      <div className="budget-sheet-scroll">
        <table className="budget-sheet-table">
          <thead>
            {groupedHeaders && <tr className="budget-sheet-brand-row">
              <th rowSpan={2} className="sheet-number-col">NO.</th>
              <th rowSpan={2} className="sheet-item-col">URAIAN ITEM</th>
              <th rowSpan={2} className="sheet-unit-col">SATUAN</th>
              {variantsByBrand.map(([brand, variants]) => <th key={brand} colSpan={variants.length}>{brand}</th>)}
              {isCatalogAdmin && <th rowSpan={2} className="sheet-action-col">AKSI</th>}
            </tr>}
            <tr>
              {!groupedHeaders && <>
                <th className="sheet-number-col">NO.</th>
                <th className="sheet-item-col">URAIAN ITEM</th>
                <th className="sheet-unit-col">SATUAN</th>
              </>}
              {detail.variants.map((variant) => <th key={variant.id}>{groupedHeaders ? finishOf(variant.label) : variant.label}</th>)}
              {!groupedHeaders && isCatalogAdmin && <th className="sheet-action-col">AKSI</th>}
            </tr>
          </thead>
          <tbody>
            {sections.map(([section, components]) => (
              <Fragment key={section}>
                <tr className="budget-sheet-section-row">
                  <td colSpan={3 + detail.variants.length + (isCatalogAdmin ? 1 : 0)}>
                    <div className="budget-group-heading">
                      {groupSelectionMode && isCatalogAdmin && detail.groups.some((group) => group.name === section) && <input aria-label={`Pilih kelompok ${section}`} type="checkbox" checked={selectedGroupIds.includes(detail.groups.find((group) => group.name === section)!.id)} onChange={(event) => {
                        const id = detail.groups.find((group) => group.name === section)!.id;
                        setSelectedGroupIds((current) => event.target.checked ? [...current, id] : current.filter((item) => item !== id));
                      }} />}
                      <strong>{section}</strong>
                      {isCatalogAdmin && detail.groups.some((group) => group.name === section) && <button className="budget-group-edit" type="button" title="Edit nama kelompok" onClick={() => {
                        const group = detail.groups.find((item) => item.name === section)!;
                        setGroupDraft({ id: group.id, name: group.name });
                      }}>EDIT NAMA</button>}
                    </div>
                  </td>
                </tr>
                {components.map((component, index) => (
                  <tr key={component.id}>
                    <td className="sheet-number-cell">{index + 1}</td>
                    <td>
                      {isCatalogAdmin
                        ? <button className="budget-sheet-item-link" type="button" onClick={() => setComponentDraft({ id: component.id, key: component.key, label: component.label, unit: component.unit, groupLabel: component.groupLabel ?? section })}>{component.label}</button>
                        : component.label}
                    </td>
                    <td className="sheet-unit-cell">{component.unit || "—"}</td>
                    {detail.variants.map((variant) => {
                      const price = component.prices[variant.key];
                      const value = price?.amount !== null && price?.amount !== undefined
                        ? formatRupiah(price.amount)
                        : price?.expression ? `ƒ ${price.expression}` : "—";
                      return <td key={variant.id} className="sheet-price-cell">
                        <button type="button" disabled={!isCatalogAdmin} title={isCatalogAdmin ? "Klik untuk mengubah harga" : undefined} onClick={() => setPriceDraft({
                          componentId: component.id,
                          variantKey: variant.key,
                          amount: price?.amount === null || price?.amount === undefined ? "" : String(price.amount),
                          expression: price?.expression ?? "",
                        })}>{value}</button>
                      </td>;
                    })}
                    {isCatalogAdmin && <td className="sheet-action-cell"><button type="button" title="Keluarkan item" aria-label={`Hapus ${component.label}`} disabled={saving} onClick={() => setDeleteTarget(component)}>&times;</button></td>}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {componentDraft && <div className="budget-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setComponentDraft(null); }}>
        <form className="budget-modal" role="dialog" aria-modal="true" aria-labelledby="budget-sheet-item-title" onSubmit={(event) => { event.preventDefault(); void saveComponent(); }}>
          <p className="eyebrow">{componentDraft.id ? "EDIT BARIS" : "BARIS BARU"}</p>
          <h2 id="budget-sheet-item-title">{componentDraft.id ? "Ubah item" : "Tambah item"}</h2>
          <label className="budget-input"><span>Uraian item</span><input autoFocus required value={componentDraft.label} onChange={(event) => setComponentDraft({ ...componentDraft, label: event.target.value })} /></label>
          <label className="budget-input"><span>Satuan</span><input value={componentDraft.unit} onChange={(event) => setComponentDraft({ ...componentDraft, unit: event.target.value })} /></label>
          <label className="budget-input"><span>Bagian lembar Excel</span><select value={componentDraft.groupLabel} onChange={(event) => setComponentDraft({ ...componentDraft, groupLabel: event.target.value })}>{sections.map(([label]) => <option key={label} value={label}>{label}</option>)}</select></label>
          <div className="budget-modal-actions"><button className="secondary-button" type="button" onClick={() => setComponentDraft(null)}>Batal</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</button></div>
        </form>
      </div>}

      {groupDraft && <div className="budget-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setGroupDraft(null); }}>
        <form className="budget-modal budget-group-modal" role="dialog" aria-modal="true" aria-labelledby="budget-group-title" onSubmit={(event) => { event.preventDefault(); void saveGroup(); }}>
          <p className="eyebrow">KELOLA KELOMPOK</p>
          <h2 id="budget-group-title">{groupDraft.id ? "Edit nama kelompok" : "Buat kelompok baru"}</h2>
          <label className="budget-input"><span>Nama kelompok</span><input autoFocus required maxLength={80} value={groupDraft.name} onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} placeholder="Contoh: KOMPONEN UTAMA" /></label>
          <div className="budget-modal-actions"><button className="budget-group-button" type="button" onClick={() => setGroupDraft(null)}>BATAL</button><button className="budget-group-button budget-group-create" type="submit" disabled={saving}>{saving ? "MENYIMPAN…" : "SIMPAN KELOMPOK"}</button></div>
        </form>
      </div>}

      {confirmGroupDelete && <div className="budget-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmGroupDelete(false); }}>
        <div className="budget-modal" role="alertdialog" aria-modal="true" aria-labelledby="budget-group-delete-title">
          <p className="eyebrow">HAPUS PERMANEN</p>
          <h2 id="budget-group-delete-title">Hapus {selectedGroupIds.length} kelompok?</h2>
          <p className="budget-help">Seluruh item dalam kelompok terpilih dan data harga terkait akan dihapus permanen dari database. Tindakan ini tidak dapat dibatalkan.</p>
          <ul className="budget-group-delete-list">{detail.groups.filter((group) => selectedGroupIds.includes(group.id)).map((group) => <li key={group.id}>{group.name} <span>({detail.components.filter((component) => component.groupLabel?.trim() === group.name).length} item)</span></li>)}</ul>
          <div className="budget-modal-actions"><button className="budget-group-button" type="button" onClick={() => setConfirmGroupDelete(false)}>BATAL</button><button className="budget-group-button budget-group-delete is-active" type="button" disabled={saving} onClick={() => void deleteSelectedGroups()}>{saving ? "MENGHAPUS…" : "HAPUS PERMANEN"}</button></div>
        </div>
      </div>}

            {priceDraft && <div className="budget-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPriceDraft(null); }}>
        <form className="budget-modal" role="dialog" aria-modal="true" aria-labelledby="budget-sheet-price-title" onSubmit={(event) => { event.preventDefault(); void savePrice(); }}>
          <p className="eyebrow">EDIT SEL HARGA</p>
          <h2 id="budget-sheet-price-title">{detail.components.find((item) => item.id === priceDraft.componentId)?.label}</h2>
          <p className="budget-help">{detail.variants.find((item) => item.key === priceDraft.variantKey)?.label}</p>
          <label className="budget-input"><span>Nilai harga (Rp)</span><input autoFocus inputMode="decimal" value={priceDraft.amount} onChange={(event) => setPriceDraft({ ...priceDraft, amount: event.target.value, expression: "" })} placeholder="Contoh: 125000" /></label>
          <label className="budget-input"><span>Atau rumus</span><input value={priceDraft.expression} onChange={(event) => setPriceDraft({ ...priceDraft, expression: event.target.value, amount: "" })} placeholder="Contoh: 90000*1.3" /></label>
          <div className="budget-modal-actions"><button className="secondary-button" type="button" onClick={() => setPriceDraft(null)}>Batal</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan harga"}</button></div>
        </form>
      </div>}

      {deleteTarget && <div className="budget-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}>
        <div className="budget-modal" role="dialog" aria-modal="true" aria-labelledby="budget-sheet-delete-title">
          <p className="eyebrow">HAPUS BARIS</p>
          <h2 id="budget-sheet-delete-title">Keluarkan item ini?</h2>
          <p className="budget-help"><strong>{deleteTarget.label}</strong> tidak akan tampil di daftar aktif. Riwayat proyek yang sudah tersimpan tetap aman.</p>
          <div className="budget-modal-actions"><button className="secondary-button" type="button" onClick={() => setDeleteTarget(null)}>Batal</button><button className="formula-danger-button" type="button" disabled={saving} onClick={() => void archiveComponent()}>{saving ? "Memproses…" : "Hapus item"}</button></div>
        </div>
      </div>}
    </section>
  );
}
