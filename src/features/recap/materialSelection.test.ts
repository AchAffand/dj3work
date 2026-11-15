import { describe, expect, it } from "vitest";
import type { BudgetCatalog, BudgetCatalogDetail } from "../../domain/budgets/types";
import { aluminiumBrands, aluminiumFinishes, aluminiumVariantId, catalogForFamily, materialFamily, relatedMaterialComponents } from "./materialSelection";

const catalogs: BudgetCatalog[] = [
  { id: "aluminium", slug: "almunium", label: "ALUMUNIUM", position: 1, active: true },
  { id: "glass", slug: "kaca", label: "KACA", position: 2, active: true },
  { id: "accessory", slug: "ass", label: "AKSESORIS", position: 3, active: true },
  { id: "door", slug: "daun-pintu", label: "DAUN PINTU", position: 4, active: true },
];

const aluminiumDetail: BudgetCatalogDetail = {
  catalog: catalogs[0],
  variants: [
    { id: "hpm-silver", key: "hpm_silver", label: "HPM · SILVER", position: 1 },
    { id: "hpm-brown", key: "hpm_brown_anodize", label: "HPM · BROWN/ANODIZE", position: 2 },
    { id: "alex-silver", key: "alexindo_silver", label: "ALEXINDO · SILVER", position: 3 },
    { id: "ykk-silver", key: "ykk_silver", label: "YKK · SILVER", position: 4 },
  ],
  components: [
    { id: "kusen-4", key: "col_c", sourceColumn: "C", label: 'KUSEN 4"/ M\'', unit: "M'", category: "Material", position: 1, prices: {} },
    { id: "kusen-3", key: "col_d", sourceColumn: "D", label: 'KUSEN 3"/ M\'', unit: "M'", category: "Material", position: 2, prices: {} },
    { id: "hollow", key: "col_e", sourceColumn: "E", label: "HOLLOW TENGAH /M'", unit: "M'", category: "Material", position: 3, prices: {} },
  ],
  rules: [],
  mappings: [],
};

const accessoryDetail: BudgetCatalogDetail = {
  catalog: catalogs[2],
  variants: [{ id: "default", key: "default", label: "HARGA 2026", position: 1 }],
  components: [
    { id: "sealant", key: "sealant", sourceColumn: "A", label: "SEALANT / M'", unit: "M'", category: "Aksesori", position: 1, prices: {} },
    { id: "handle-lock", key: "handle_lock", sourceColumn: "B", label: "HANDLE + KUNCI", unit: "SET", category: "Aksesori", position: 2, prices: {} },
  ],
  rules: [], mappings: [],
};

const doorDetail: BudgetCatalogDetail = {
  catalog: catalogs[3],
  variants: [{ id: "default", key: "default", label: "HARGA 2026", position: 1 }],
  components: [
    { id: "door-base", key: "door_base", sourceColumn: "A", label: "PINTU KAYU JATI / UNIT", unit: "UNIT", category: "Daun Pintu", position: 1, prices: {} },
    { id: "melamin", key: "melamin", sourceColumn: "B", label: "MELAMIN / DAUN", unit: "DAUN", category: "Daun Pintu", position: 2, prices: {} },
    { id: "duco", key: "duco", sourceColumn: "C", label: "FINISHING DUCO PINTU/ DAUN", unit: "DAUN", category: "Daun Pintu", position: 3, prices: {} },
  ],
  rules: [], mappings: [],
};

describe("relational material selection", () => {
  it("classifies kusen as aluminium and routes it to the aluminium catalog", () => {
    expect(materialFamily("Kusen", "M'")).toBe("aluminium");
    expect(catalogForFamily("aluminium", catalogs)?.id).toBe("aluminium");
  });

  it("exposes only the 3 and 4 inch profiles for kusen selection", () => {
    expect(relatedMaterialComponents(aluminiumDetail, "aluminium", "Kusen").map((item) => item.id)).toEqual(["kusen-4", "kusen-3"]);
  });

  it("matches non-kusen aluminium items to their own components", () => {
    expect(materialFamily("Hollow tengah", "M'")).toBe("aluminium");
    expect(relatedMaterialComponents(aluminiumDetail, "aluminium", "Hollow tengah").map((item) => item.id)).toEqual(["hollow"]);
    expect(materialFamily("Pintu", "M'")).toBe("aluminium");
  });

  it("separates aluminium brands from finish variants while retaining the exact price variant", () => {
    expect(aluminiumBrands(aluminiumDetail)).toEqual(["HPM", "ALEXINDO", "YKK"]);
    expect(aluminiumFinishes(aluminiumDetail, "HPM")).toEqual(["SILVER", "BROWN/ANODIZE"]);
    expect(aluminiumVariantId(aluminiumDetail, "HPM", "BROWN/ANODIZE")).toBe("hpm-brown");
  });

  it("maps silicone to the sealant accessory and handle plus lock to its exact component", () => {
    expect(materialFamily("Silicone", "M'")).toBe("accessory");
    expect(relatedMaterialComponents(accessoryDetail, "accessory", "Silicone").map((item) => item.id)).toEqual(["sealant"]);
    expect(relatedMaterialComponents(accessoryDetail, "accessory", "HANDLE + KUNCI").map((item) => item.id)).toEqual(["handle-lock"]);
    expect(accessoryDetail.variants).toHaveLength(1);
  });

  it("keeps door leaf base choices separate from melamin and duco finishing components", () => {
    expect(relatedMaterialComponents(doorDetail, "door-leaf", "Daun Pintu").map((item) => item.id)).toEqual(["door-base"]);
    expect(doorDetail.components.filter((item) => /melamin|finishing duco/i.test(item.label)).map((item) => item.id)).toEqual(["melamin", "duco"]);
  });

  it("routes glass, accessory and door-leaf rows to their own families", () => {
    expect(materialFamily("Kaca", "M2")).toBe("glass");
    expect(materialFamily("Engsel Kupu", "pcs")).toBe("accessory");
    expect(materialFamily("Daun Pintu", "unit")).toBe("door-leaf");
  });
});
