import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppServicesProvider } from "../../app/AppServices";
import { doorCatalog } from "../../domain/catalog/doorCatalog";
import type { DoorModel } from "../../domain/catalog/types";
import type { Project } from "../../domain/projects/types";
import { createSupabaseRepository } from "../../integrations/supabase/repository";
import { ProjectPrintPage } from "./ProjectPrintPage";

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { email: "operator@dj3.com", user_metadata: { full_name: "Operator DJ3" } } }),
}));

const project: Project = {
  id: "project-1",
  offerNumber: 1001,
  name: "Rumah Contoh",
  location: "Bandung",
  floor: "2",
  createdAt: "2026-10-01T00:00:00.000Z",
  lines: [{
    id: "line-1",
    modelCode: 10100,
    inputs: { T1: 2000, L1: 1754, daunPintu: 2 },
    count: 2,
    formulaSnapshot: [],
    resultSnapshot: { items: [
      { materialCode: 10101, name: "Kusen", unit: "m'", quantity: 5.754 },
      { materialCode: 10102, name: "Tapin", unit: "m'", quantity: 5.754 },
    ], errors: [] },
  }],
  prices: [
    { materialCode: 10101, name: "Kusen", unit: "m'", unitPrice: 50000 },
    { materialCode: 10102, name: "Tapin", unit: "m'", unitPrice: null },
  ],
  extraMaterials: [{
    id: "4f3c6c08-4bd0-4c5f-9a33-8f59eabbb001",
    name: "HANDLE + KUNCI", unit: "SET", quantity: 2,
    catalogId: null, variantId: null, componentId: "handle-lock", unitPrice: 125000,
    modelLineId: "line-1",
  }],
};

describe("ProjectPrintPage", () => {
  beforeEach(() => vi.stubGlobal("print", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("prints per-model quotation cards, with the DJ3 logo and two-line title", async () => {
    const repository = { loadProject: vi.fn(async () => project) } as unknown as ReturnType<typeof createSupabaseRepository>;
    render(
      <AppServicesProvider override={{
        repository,
        catalog: doorCatalog as ReadonlyMap<number, DoorModel>,
        loadingCatalog: false,
        catalogError: null,
        isCatalogAdmin: false,
        reloadCatalog: vi.fn(async () => undefined),
      }}>
        <MemoryRouter initialEntries={["/projects/project-1/print"]}>
          <Routes><Route path="/projects/:projectId/print" element={<ProjectPrintPage />} /></Routes>
        </MemoryRouter>
      </AppServicesProvider>,
    );

    expect(await screen.findByText("Rumah Contoh")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Penawaran Harga/ })).toBeInTheDocument();
    expect(screen.getByAltText("DJ3 Engineering")).toHaveAttribute("src", "/dj3work/logodj3merah.png?v=20261116");
    expect(screen.getByRole("textbox", { name: "Lokasi" })).toHaveValue("Bandung");
    expect(screen.getByRole("textbox", { name: "Customer" })).toHaveValue("Rumah Contoh");
    expect(screen.getByRole("textbox", { name: "Lantai" })).toHaveValue("2");
    expect(screen.getByDisplayValue("2026-10-01")).toBeInTheDocument();
    expect(screen.getByText("1001/DJ3/X/2026")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nama model 01" })).toHaveValue(expect.stringContaining("PINTU"));
    expect(screen.getByRole("columnheader", { name: "HARGA SAT" })).toBeInTheDocument();
    expect(screen.getByText("HANDLE + KUNCI")).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*575\.400/)).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*250\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Operator DJ3 · DJ3 ENGINEERING/)).toBeInTheDocument();
    const user = userEvent.setup();
    const modelTitle = screen.getByRole("textbox", { name: "Nama model 01" });
    await user.clear(modelTitle);
    await user.type(modelTitle, "PINTU ALUMINIUM PREMIUM");
    expect(modelTitle).toHaveValue("PINTU ALUMINIUM PREMIUM");
    await user.click(screen.getByRole("button", { name: "Cetak / Simpan PDF" }));
    expect(window.print).toHaveBeenCalledOnce();
  });
});
