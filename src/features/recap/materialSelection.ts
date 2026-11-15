import type { BudgetCatalog, BudgetCatalogDetail, BudgetComponent } from "../../domain/budgets/types";
import { isAccessoryMaterial, isGlassMaterial, isDoorLeafMaterial } from "../../domain/budgets/pricing";

export type MaterialFamily = "aluminium" | "glass" | "accessory" | "door-leaf" | "other";

const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");

export function materialFamily(name: string, unit: string): MaterialFamily {
  const normalizedName = normalize(name);
  if (/\b(kusen|aluminium|almunium|hollow|tapin|tatapan|louver|spandrell|canal|acp|jendela|rell)\b/.test(normalizedName) || (normalizedName === "pintu" && normalize(unit) === "m'")) return "aluminium";
  if (isDoorLeafMaterial({ name, unit }) || /daun pintu|pintu kayu|pintu hdf|pintu wpc|pintu pvc/.test(normalizedName) || (normalizedName === "pintu" && ["set", "unit", "daun"].includes(normalize(unit)))) return "door-leaf";
  if (isGlassMaterial({ name, unit })) return "glass";
  if (isAccessoryMaterial({ name, unit })) return "accessory";
  return "other";
}

export function catalogForFamily(
  family: MaterialFamily,
  catalogs: readonly BudgetCatalog[],
): BudgetCatalog | undefined {
  const slugByFamily: Partial<Record<MaterialFamily, string>> = {
    aluminium: "almunium",
    glass: "kaca",
    accessory: "ass",
    "door-leaf": "daun-pintu",
  };
  const slug = slugByFamily[family];
  return slug ? catalogs.find((item) => normalize(item.slug) === slug) : undefined;
}

export type AluminiumVariantChoice = { brand: string; finish: string; variantId: string };

// Master Harga stores brand and finish in one variant label; expose them as separate UI choices.
export function aluminiumVariantChoices(detail: BudgetCatalogDetail | undefined): AluminiumVariantChoice[] {
  if (!detail) return [];
  return detail.variants.flatMap((variant) => {
    const separator = variant.label.includes("·") ? "·" : variant.label.includes("|") ? "|" : "";
    if (!separator) return [];
    const [brand, ...finishParts] = variant.label.split(separator);
    const finish = finishParts.join(separator).trim();
    return brand?.trim() && finish ? [{ brand: brand.trim(), finish, variantId: variant.id }] : [];
  });
}

export function aluminiumBrands(detail: BudgetCatalogDetail | undefined): string[] {
  return [...new Set(aluminiumVariantChoices(detail).map((item) => item.brand))];
}

export function aluminiumFinishes(detail: BudgetCatalogDetail | undefined, brand: string): string[] {
  return [...new Set(aluminiumVariantChoices(detail).filter((item) => item.brand === brand).map((item) => item.finish))];
}

export function aluminiumVariantId(detail: BudgetCatalogDetail | undefined, brand: string, finish: string): string | null {
  return aluminiumVariantChoices(detail).find((item) => item.brand === brand && item.finish === finish)?.variantId ?? null;
}

export function relatedMaterialComponents(
  detail: BudgetCatalogDetail | undefined,
  family: MaterialFamily,
  materialName: string,
): BudgetComponent[] {
  if (!detail) return [];
  if (family === "aluminium") {
    if (/\bkusen\b/i.test(materialName)) {
      return detail.components.filter((component) => /^KUSEN\s*[34]\b/i.test(component.label));
    }
    const needle = normalize(materialName);
    const candidates = detail.components.filter((component) => normalize(component.category) === "material");
    const matches = candidates.filter((component) => normalize(component.label).includes(needle));
    return matches.length ? matches : candidates;
  }
  const category = family === "glass" ? "Kaca" : family === "accessory" ? "Aksesori" : family === "door-leaf" ? "Daun Pintu" : "";
  const candidates = detail.components
    .filter((component) => normalize(component.category) === normalize(category))
    .sort((a, b) => a.position - b.position);
  if (family !== "accessory") return candidates;

  const needle = normalize(materialName).replace(/\b(pcs|set|unit|m2|m')\b/g, "").trim();
  const matches = candidates.filter((component) => {
    const label = normalize(component.label);
    return label.includes(needle) || needle.includes(label);
  });
  return matches.length ? matches : candidates;
}

export function componentLabel(component: BudgetComponent): string {
  return component.label.replace(/\s*\/\s*(m2|m')\s*$/i, "").trim();
}
