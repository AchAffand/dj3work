import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppPageState } from "../../app/AppPageState";
import { formatQuantity, formatRupiah } from "../../app/format";
import { modelGroupLabel } from "../../domain/catalog/types";
import type { Project, ProjectExtraMaterial } from "../../domain/projects/types";
import { useAppServices } from "../../app/AppServices";
import { useAuth } from "../../auth/AuthProvider";
import { parseFormulaOptionMaterialKey, supportsMultipleBudgetComponents } from "../recap/materialSelection";

type PrintRow = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  subtotal: number | null;
  materialCode?: number;
};

function extraMaterialBelongsToLine(item: ProjectExtraMaterial, lineId: string | undefined, lineIndex: number): boolean {
  const option = parseFormulaOptionMaterialKey(item.name);
  if (option) return option.modelIndex === lineIndex + 1;
  return Boolean(item.modelLineId && item.modelLineId === lineId);
}

export function ProjectPrintPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { repository, catalog, budgetDetails } = useAppServices();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");
  const [location, setLocation] = useState("");
  const [floor, setFloor] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [offerNumber, setOfferNumber] = useState("");

  useEffect(() => {
    let active = true;
    if (!repository) {
      setError("Koneksi database belum tersedia.");
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError(null);
    void repository.loadProject(projectId).then((loaded) => {
      if (active) {
        setProject(loaded);
        if (loaded) {
          setCustomer(loaded.name);
          setLocation(loaded.location ?? "");
          setFloor(loaded.floor ?? "");
          setReportDate((loaded.createdAt ?? new Date().toISOString()).slice(0, 10));
          const createdAt = new Date(loaded.createdAt ?? new Date().toISOString());
          const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
          setOfferNumber(`${loaded.offerNumber ?? 1001}/DJ3/${romanMonths[createdAt.getMonth()]}/${createdAt.getFullYear()}`);
        } else setError("Proyek tidak ditemukan atau tidak dapat dibuka.");
      }
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Penawaran proyek tidak dapat dibuka.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [projectId, repository]);

  const modelSections = useMemo(() => {
    if (!project) return [];
    return project.lines.map((line, lineIndex) => {
      const model = catalog.get(line.modelCode);
      const optionMaterials = (project.extraMaterials ?? []).filter((item) => {
        const option = parseFormulaOptionMaterialKey(item.name);
        return option?.modelIndex === lineIndex + 1;
      });
      const rows: PrintRow[] = line.resultSnapshot.items.flatMap((material) => {
        const hasOptions = optionMaterials.some((item) => parseFormulaOptionMaterialKey(item.name)?.materialCode === material.materialCode);
        if (supportsMultipleBudgetComponents(material.name) && hasOptions) return [];
        const candidates = project.prices.filter((item) => item.materialCode === material.materialCode);
        const exactPrice = line.priceCatalogId && line.priceVariantId
          ? candidates.find((item) => item.catalogId === line.priceCatalogId && item.variantId === line.priceVariantId)
          : undefined;
        const price = exactPrice ?? candidates.find((item) => item.unitPrice !== null) ?? candidates[0];
        const quantity = material.quantity * line.count;
        return [{
          name: material.name,
          quantity,
          unit: material.unit,
          unitPrice: price?.unitPrice ?? null,
          subtotal: price?.unitPrice == null ? null : Math.round(quantity * price.unitPrice * 100) / 100,
          materialCode: material.materialCode,
        }];
      });
      for (const item of (project.extraMaterials ?? []).filter((extra) => extraMaterialBelongsToLine(extra, line.id, lineIndex))) {
        const option = parseFormulaOptionMaterialKey(item.name);
        const detail = item.catalogId ? budgetDetails?.get(item.catalogId) : undefined;
        const component = detail?.components.find((candidate) => candidate.id === item.componentId);
        const name = item.name.startsWith("__door_finish__:")
          ? `Finishing daun pintu · ${component?.label ?? "Finishing"}`
          : option ? component?.label ?? "Item formula" : item.name;
        const quantity = item.quantity * line.count;
        rows.push({
          name,
          quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          subtotal: item.unitPrice == null ? null : Math.round(quantity * item.unitPrice * 100) / 100,
          materialCode: option?.materialCode,
        });
      }
      const subtotal = rows.reduce((sum, row) => sum + (row.subtotal ?? 0), 0);
      const missingPriceCount = rows.filter((row) => row.unitPrice === null).length;
      return {
        id: line.id ?? `line-${lineIndex}`,
        number: String(lineIndex + 1).padStart(2, "0"),
        title: `${modelGroupLabel(model?.groupCode ?? 0, model?.groupName).toUpperCase()} ${model?.name ?? line.modelCode}`,
        count: line.count,
        rows,
        subtotal,
        missingPriceCount,
      };
    });
  }, [budgetDetails, catalog, project]);

  const globalExtras = useMemo(() => {
    if (!project) return [] as PrintRow[];
    return (project.extraMaterials ?? [])
      .filter((item) => !item.modelLineId && !parseFormulaOptionMaterialKey(item.name))
      .map((item) => {
        const detail = item.catalogId ? budgetDetails?.get(item.catalogId) : undefined;
        const component = detail?.components.find((candidate) => candidate.id === item.componentId);
        const name = item.name.startsWith("__door_finish__:")
          ? `Finishing daun pintu · ${component?.label ?? "Finishing"}`
          : item.name;
        return {
          name,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          subtotal: item.unitPrice == null ? null : Math.round(item.quantity * item.unitPrice * 100) / 100,
        };
      });
  }, [budgetDetails, project]);

  const grandTotal = [...modelSections, { subtotal: globalExtras.reduce((sum, row) => sum + (row.subtotal ?? 0), 0) }]
    .reduce((sum, section) => sum + section.subtotal, 0);
  const missingPriceCount = modelSections.reduce((sum, section) => sum + section.missingPriceCount, 0)
    + globalExtras.filter((row) => row.unitPrice === null).length;
  const authorName = typeof user?.user_metadata.full_name === "string" && user.user_metadata.full_name.trim()
    ? user.user_metadata.full_name.trim()
    : user?.email ?? "DJ3 Engineering";

  if (loading) return <AppPageState title="Menyiapkan penawaran" detail="Data proyek sedang dimuat." />;
  if (error || !project) {
    return <AppPageState title="Penawaran belum dapat dibuka" detail={error ?? "Proyek tidak ditemukan."} tone="error" actionLabel="Kembali ke proyek" onAction={() => navigate("/projects")} />;
  }

  return (
    <section className="page-content project-print-page">
      <div className="print-actions">
        <button className="secondary-button" type="button" onClick={() => navigate("/projects")}>Kembali ke proyek</button>
        <button className="secondary-button" type="button" onClick={() => navigate(`/calculator?project=${encodeURIComponent(project.id)}`)}>Edit perhitungan</button>
        <button className="primary-button" type="button" onClick={() => window.print()}>Cetak / Simpan PDF</button>
      </div>

      <article className="project-report">
        <header className="project-offer-header">
          <div className="project-offer-brand">
            <img src={`${import.meta.env.BASE_URL}logodj3merah.png?v=20261116`} alt="DJ3 Engineering" />
          </div>
          <h1 className="project-offer-title"><span>Penawaran</span><span>Harga</span></h1>
        </header>

        <dl className="project-offer-meta">
          <div><dt>CUSTOMER</dt><dd><input aria-label="Customer" value={customer} onChange={(event) => setCustomer(event.target.value)} /></dd></div>
          <div><dt>LOKASI</dt><dd><input aria-label="Lokasi" value={location} onChange={(event) => setLocation(event.target.value)} /></dd></div>
          <div><dt>LANTAI</dt><dd><input aria-label="Lantai" value={floor} onChange={(event) => setFloor(event.target.value)} /></dd></div>
          <div><dt>NO. PENAWARAN</dt><dd><input aria-label="Nomor penawaran" value={offerNumber} onChange={(event) => setOfferNumber(event.target.value)} /></dd></div>
          <div><dt>TANGGAL</dt><dd><input aria-label="Tanggal penawaran" type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} /></dd></div>
        </dl>

        <div className="project-offer-sections">
          {modelSections.map((section) => (
            <section className="project-offer-model" key={section.id}>
              <div className="project-offer-model-heading">
                <h2><span>{section.number}</span>{section.title}{section.count > 1 && <small> × {section.count}</small>}</h2>
                <strong><span>SUBTOTAL</span>{formatRupiah(section.subtotal)}</strong>
              </div>
              <table className="project-offer-table">
                <thead><tr><th>ITEM</th><th>QTY</th><th>HARGA SAT</th><th>SATUAN</th><th>SUB TOTAL</th></tr></thead>
                <tbody>
                  {section.rows.length ? section.rows.map((row, index) => (
                    <tr key={`${section.id}-${row.materialCode ?? row.name}-${index}`}>
                      <td>{row.name}</td>
                      <td>{formatQuantity(row.quantity)}</td>
                      <td>{row.unitPrice === null ? "—" : formatRupiah(row.unitPrice)}</td>
                      <td>{row.unit}</td>
                      <td>{row.subtotal === null ? "—" : formatRupiah(row.subtotal)}</td>
                    </tr>
                  )) : <tr><td colSpan={5}>Belum ada rincian material</td></tr>}
                </tbody>
              </table>
            </section>
          ))}
          {globalExtras.length > 0 && (
            <section className="project-offer-model">
              <div className="project-offer-model-heading">
                <h2><span>{String(modelSections.length + 1).padStart(2, "0")}</span>MATERIAL TAMBAHAN</h2>
                <strong><span>SUBTOTAL</span>{formatRupiah(globalExtras.reduce((sum, row) => sum + (row.subtotal ?? 0), 0))}</strong>
              </div>
              <table className="project-offer-table">
                <thead><tr><th>ITEM</th><th>QTY</th><th>HARGA SAT</th><th>SATUAN</th><th>SUB TOTAL</th></tr></thead>
                <tbody>{globalExtras.map((row, index) => <tr key={`global-extra-${index}`}><td>{row.name}</td><td>{formatQuantity(row.quantity)}</td><td>{row.unitPrice === null ? "—" : formatRupiah(row.unitPrice)}</td><td>{row.unit}</td><td>{row.subtotal === null ? "—" : formatRupiah(row.subtotal)}</td></tr>)}</tbody>
              </table>
            </section>
          )}
        </div>

        <footer className="project-offer-footer">
          <div><span>GRAND TOTAL</span><strong>{formatRupiah(grandTotal)}</strong></div>
          {missingPriceCount > 0 && <p>{missingPriceCount} harga satuan belum diisi; total sementara hanya menjumlahkan item yang memiliki harga.</p>}
          <small>{authorName} · DJ3 ENGINEERING</small>
        </footer>
      </article>
    </section>
  );
}
