import { describe, expect, it } from "vitest";
import type { BudgetCatalog, BudgetCatalogDetail } from "../../domain/budgets/types";
import { aluminiumBrands, aluminiumFinishes, aluminiumVariantId, catalogForFamily, materialFamily, relatedMaterialComponents } from "./materialSelection";

const catalogs: BudgetCatalog[] = [
  { id: "aluminium", slug: "almunium", label: "ALUMUNIUM", position: 1, active: true },
  { id: "glass", slug: "kaca", label: "KACA", position: 2, active: true },
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

describe("relational material selection", () => {
  it("classifies kusen as aluminium and routes it to the aluminium catalog", () => {
    expect(materialFamily("Kusen", "M'")).toBe("aluminium");
    expect(catalogForFamily("aluminium", catalogs)?.id).toBe("aluminium");
  });

  it("exposes only the 3 and 4 inch profiles for kusen selection", () => {
    expect(relatedMaterialComponents(aluminiumDetail, "aluminium", "Kusen").map((item) => item.id)).toEqual(["kusen-4", "kusen-3"]);
  });

  it("separates aluminium brands from finish variants while retaining the exact price variant", () => {
    expect(aluminiumBrands(aluminiumDetail)).toEqual(["HPM", "ALEXINDO", "YKK"]);
    expect(aluminiumFinishes(aluminiumDetail, "HPM")).toEqual(["SILVER", "BROWN/ANODIZE"]);
    expect(aluminiumVariantId(aluminiumDetail, "HPM", "BROWN/ANODIZE")).toBe("hpm-brown");
  });

  it("routes glass, accessory and door-leaf rows to their own families", () => {
    expect(materialFamily("Kaca", "M2")).toBe("glass");
    expect(materialFamily("Engsel Kupu", "pcs")).toBe("accessory");
    expect(materialFamily("Daun Pintu", "unit")).toBe("door-leaf");
  });
});
