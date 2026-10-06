export const CACHE_TAGS = {
  activeRetailers: "active-retailers",
  activeProducts: "active-products",
  activeSuppliers: "active-suppliers",
  settings: "settings",
  financeCategories: "finance-categories",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
