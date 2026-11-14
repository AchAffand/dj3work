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
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <AppPageState title="Memuat Master Harga" detail="Membuka empat lembar workbook." />;
  if (error) return <AppPageState title="Master Harga belum dapat dimuat" detail={error} tone="error" actionLabel="Coba lagi" onAction={() => void load()} />;

  return (
    <section className="page-content budget-workbook-home">
      <div className="page-heading-row">
        <div className="page-intro">
          <p className="eyebrow">WORKBOOK · MASTER BUDGET KUSEN 2026</p>
          <h1>Master Harga</h1>
          <p className="page-description">Pilih salah satu lembar, seperti berpindah sheet di Excel.</p>
        </div>
      </div>
      <div className="budget-workbook-list">
        {catalogs.map((catalog, index) => (
          <button className="budget-workbook-tab-card" key={catalog.id} type="button" onClick={() => navigate(`/master-harga/${catalog.slug}`)}>
            <span className="budget-workbook-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="budget-workbook-name">{catalog.label}</span>
            <span className="budget-workbook-open">Buka lembar <span aria-hidden="true">↗</span></span>
          </button>
        ))}
      </div>
    </section>
  );
}
