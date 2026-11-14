import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppPageState } from "../../app/AppPageState";
import { useAppServices } from "../../app/AppServices";
import type { BudgetCatalog } from "../../domain/budgets/types";

export function BudgetWorkspacePage() {
  const { repository } = useAppServices();
  const navigate = useNavigate();
  const [catalogs, setCatalogs] = useState<BudgetCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!repository) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      setCatalogs(await repository.listBudgetCatalogs());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Master harga belum dapat dimuat.");
    } finally { setLoading(false); }
  }, [repository]);
  useEffect(() => { void load(); }, [load]);

  const deleteGroup = async (catalog: BudgetCatalog) => {
    if (!repository || deletingId) return;
    const confirmed = window.confirm(
      `Hapus kelompok "${catalog.label}" secara permanen? Seluruh item dan harga di dalamnya juga akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
    );
    if (!confirmed) return;
    setDeletingId(catalog.id); setError(null);
    try {
      await repository.deleteBudgetCatalog(catalog.id);
      setCatalogs((current) => current.filter((item) => item.id !== catalog.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kelompok gagal dihapus.");
    } finally { setDeletingId(null); }
  };

  if (loading) return <AppPageState title="Memuat Master Harga" detail="Katalog dan perkiraan sedang dibuka." />;
  if (error && catalogs.length === 0) return <AppPageState title="Master Harga belum dapat dimuat" detail={error} tone="error" actionLabel="Coba lagi" onAction={() => void load()} />;

  return <section className="page-content">
    <div className="page-heading-row">
      <div className="page-intro">
        <p className="eyebrow">ANGGARAN KUSEN</p>
        <h1>Master Harga</h1>
        <p className="page-description">Kelola kelompok harga dan item berdasarkan workbook Master Budget Kusen 2026.</p>
      </div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="budget-catalog-grid">
      {catalogs.map((catalog) => <article className="budget-catalog-card" key={catalog.id}>
        <div>
          <p className="eyebrow">KELOMPOK {String(catalog.position).padStart(2, "0")}</p>
          <h2>{catalog.label}</h2>
          <p>Kelola daftar item dan harga pada kelompok ini.</p>
        </div>
        <div className="budget-card-actions">
          <button className="secondary-button" type="button" onClick={() => navigate(`/master-harga/${catalog.slug}?mode=items`)}>
            Kelola Item
          </button>
          <button className="formula-danger-button" type="button" disabled={deletingId !== null} onClick={() => void deleteGroup(catalog)}>
            {deletingId === catalog.id ? "Menghapus..." : "Hapus Kelompok"}
          </button>
        </div>
      </article>)}
    </div>
  </section>;
}
