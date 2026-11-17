import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppPageState } from "../../app/AppPageState";
import { useAppServices } from "../../app/AppServices";
import { useToast } from "../../app/ToastProvider";
import type { BudgetCatalog } from "../../domain/budgets/types";

type GroupDraft = { id?: string; label: string };
type DeleteTarget = BudgetCatalog | null;

export function BudgetWorkspacePage() {
  const { repository, isCatalogAdmin, reloadBudgets } = useAppServices();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [catalogs, setCatalogs] = useState<BudgetCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const load = useCallback(async () => {
    if (!repository) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const sheets = await repository.listBudgetCatalogs();
      setCatalogs(sheets.sort((a, b) => a.position - b.position));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Master harga belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);

  const saveGroup = async () => {
    if (!repository || !groupDraft) return;
    const label = groupDraft.label.trim();
    if (!label) { notify("error", "Nama kelompok wajib diisi."); return; }
    setSaving(true);
    
    try {
      if (groupDraft.id) {
        await repository.renameBudgetCatalog(groupDraft.id, label);
        notify("success", "Nama kelompok berhasil diperbarui.");
      } else {
        await repository.createBudgetCatalog(label);
        notify("success", "Kelompok baru berhasil ditambahkan.");
      }
      setGroupDraft(null);
      await load();
      await reloadBudgets?.();
    } catch (cause) {
      notify("error", cause instanceof Error ? cause.message : "Kelompok gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async () => {
    if (!repository || !deleteTarget) return;
    setSaving(true);
    
    try {
      await repository.deleteBudgetCatalog(deleteTarget.id);
      notify("success", `Kelompok "${deleteTarget.label}" dan seluruh itemnya berhasil dihapus permanen.`);
      setDeleteTarget(null);
      await load();
      await reloadBudgets?.();
    } catch (cause) {
      notify("error", cause instanceof Error ? cause.message : "Kelompok gagal dihapus.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppPageState title="Memuat Master Harga" detail="Membuka lembar workbook." />;
  if (error) return <AppPageState title="Master Harga belum dapat dimuat" detail={error} tone="error" actionLabel="Coba lagi" onAction={() => void load()} />;

  return (
    <section className="page-content budget-workbook-home">
      <div className="page-heading-row">
        <div className="page-intro">
          <p className="eyebrow">WORKBOOK · MASTER BUDGET KUSEN 2026</p>
          <h1>Master Harga</h1>
          <p className="page-description">Pilih lembar harga seperti berpindah sheet di Excel.</p>
        </div>
        {isCatalogAdmin && <button className="primary-button" type="button" onClick={() => { setGroupDraft({ label: "" });  }}>+ Tambah Kelompok</button>}
      </div>

      {!isCatalogAdmin && <div className="notice-banner">Mode lihat saja. Pengelolaan kelompok memerlukan akses admin katalog.</div>}

      <div className="budget-workbook-list">
        {catalogs.map((catalog, index) => (
          <article className="budget-workbook-tab-card" key={catalog.id}>
            <span className="budget-workbook-index">{String(index + 1).padStart(2, "0")}</span>
            <button className="budget-workbook-open-button" type="button" onClick={() => navigate(`/master-harga/${catalog.slug}`)}>
              <span className="budget-workbook-name">{catalog.label}</span>
              <span className="budget-workbook-open">Buka lembar <span aria-hidden="true">↗</span></span>
            </button>
            {isCatalogAdmin && <div className="budget-card-actions">
              <button className="secondary-button" type="button" disabled={saving} onClick={() => { setGroupDraft({ id: catalog.id, label: catalog.label });  }}>Edit Kelompok</button>
              <button className="formula-danger-button" type="button" disabled={saving} onClick={() => setDeleteTarget(catalog)}>Hapus Kelompok</button>
            </div>}
          </article>
        ))}
        {!catalogs.length && <div className="notice-banner">Belum ada kelompok Master Harga.</div>}
      </div>

      {groupDraft && <div className="budget-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setGroupDraft(null); }}>
        <form className="budget-modal" role="dialog" aria-modal="true" aria-labelledby="budget-group-title" onSubmit={(event) => { event.preventDefault(); void saveGroup(); }}>
          <p className="eyebrow">{groupDraft.id ? "EDIT KELOMPOK" : "KELOMPOK BARU"}</p>
          <h2 id="budget-group-title">{groupDraft.id ? "Ubah nama kelompok" : "Tambah kelompok Master Harga"}</h2>
          <label className="budget-input">
            <span>Nama kelompok</span>
            <input autoFocus required maxLength={80} value={groupDraft.label} onChange={(event) => setGroupDraft({ ...groupDraft, label: event.target.value })} placeholder="Contoh: AKSESORIS" />
          </label>
          {!groupDraft.id && <p className="budget-help">Kelompok baru akan dibuat dengan satu kolom harga awal bernama “Harga”. Nama kelompok dapat diubah kapan saja.</p>}
          <div className="budget-modal-actions">
            <button className="secondary-button" type="button" disabled={saving} onClick={() => setGroupDraft(null)}>Batal</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan kelompok"}</button>
          </div>
        </form>
      </div>}

      {deleteTarget && <div className="budget-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDeleteTarget(null); }}>
        <div className="budget-modal" role="dialog" aria-modal="true" aria-labelledby="budget-group-delete-title">
          <p className="eyebrow">HAPUS KELOMPOK</p>
          <h2 id="budget-group-delete-title">Hapus “{deleteTarget.label}”?</h2>
          <p className="budget-help">Tindakan ini menghapus kelompok beserta seluruh item, varian, dan harga di dalamnya secara permanen. Perkiraan Master Harga tersimpan yang memakai kelompok ini juga akan terhapus. Tindakan ini tidak dapat dibatalkan.</p>
          <div className="budget-modal-actions budget-delete-actions">
            <button className="secondary-button" type="button" disabled={saving} onClick={() => setDeleteTarget(null)}>Batal</button>
            <button className="formula-danger-button" type="button" disabled={saving} onClick={() => void deleteGroup()}>{saving ? "Menghapus…" : "Hapus permanen"}</button>
          </div>
        </div>
      </div>}
    </section>
  );
}
