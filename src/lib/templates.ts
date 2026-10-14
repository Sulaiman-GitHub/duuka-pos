// Starter categories by type of business. When the platform owner creates a shop they tick what the shop sells, and
// the matching categories are created for it. The shop can add, rename or remove categories afterwards.
export const BUSINESS_TYPES = [
  { key: "electronics", label: "Electronics & accessories", categories: ["Phones & tablets", "Computers & laptops", "Accessories", "Audio & headphones", "Chargers & power banks", "Batteries", "TVs & displays", "Cables & adapters"] },
  { key: "groceries", label: "Supermarket / groceries", categories: ["Beverages", "Groceries", "Bakery", "Dairy & eggs", "Fresh produce", "Snacks", "Household", "Personal care"] },
  { key: "pharmacy", label: "Pharmacy & health", categories: ["Prescription medicines", "Over-the-counter", "Vitamins & supplements", "First aid", "Baby care", "Personal hygiene", "Medical devices"] },
  { key: "clothing", label: "Clothing & shoes", categories: ["Men", "Women", "Children", "Shoes", "Bags & accessories", "Uniforms"] },
  { key: "hardware", label: "Hardware & building", categories: ["Tools", "Building materials", "Paint & finishing", "Plumbing", "Electrical", "Fasteners & fittings", "Garden"] },
  { key: "beauty", label: "Beauty & cosmetics", categories: ["Skin care", "Hair care", "Makeup", "Fragrances", "Nails", "Men's grooming"] },
  { key: "stationery", label: "Stationery & books", categories: ["Books", "Exercise books & paper", "Writing instruments", "Office supplies", "School supplies", "Art & craft"] },
  { key: "general", label: "General retail", categories: ["General"] },
] as const;

export type BusinessTypeKey = (typeof BUSINESS_TYPES)[number]["key"];

/** The distinct category names for the chosen business types, in a stable order. */
export function categoriesFor(keys: string[]): string[] {
  const names: string[] = [];
  for (const t of BUSINESS_TYPES) if (keys.includes(t.key)) for (const c of t.categories) if (!names.includes(c)) names.push(c);
  return names;
}
