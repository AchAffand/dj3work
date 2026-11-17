import type { ComponentType } from "react";
import { CalculatorPage } from "../features/calculator/CalculatorPage";
import { FormulaMasterPage } from "../features/formula-master/FormulaMasterPage";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { BudgetWorkspacePage } from "../features/budgets/BudgetWorkspacePage";
import { SettingsPage } from "../features/settings/SettingsPage";

export type FeatureDefinition = {
  id: string;
  label: string;
  path: string;
  icon: string;
  description: string;
  component: ComponentType;
  /** Akses halaman tetap diperiksa di dalam komponen tujuan. */
  adminOnly?: boolean;
};

export const featureRegistry: readonly FeatureDefinition[] = [
  {
    id: "calculator",
    label: "Kalkulator Kusen",
    path: "/calculator",
    icon: "⌗",
    description: "Hitung kebutuhan kusen dan material.",
    component: CalculatorPage,
  },
  {
    id: "projects",
    label: "Proyek",
    path: "/projects",
    icon: "▤",
    description: "Kelola proyek dan penawaran tersimpan.",
    component: ProjectsPage,
  },
  {
    id: "formula-master",
    label: "Master Rumus",
    path: "/formulas",
    icon: "ƒx",
    description: "Atur formula perhitungan material.",
    component: FormulaMasterPage,
  },
  {
    id: "budget-master",
    label: "Master Harga",
    path: "/master-harga",
    icon: "▦",
    description: "Kelola daftar harga dan katalog.",
    component: BudgetWorkspacePage,
  },
  {
    id: "settings",
    label: "Pengaturan",
    path: "/pengaturan",
    icon: "⚙",
    description: "Atur akun dan akses ruang kerja.",
    component: SettingsPage,
    adminOnly: true,
  },
];
