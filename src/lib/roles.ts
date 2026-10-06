export const ADMIN_PASSWORD = "demo-admin";
export const STAFF_PASSWORD = "demo-staff";
export const AUTH_COOKIE = "soycraft_auth";

export type Role = "admin" | "staff";

export function roleFromCookie(value: string | undefined): Role | null {
  if (value === ADMIN_PASSWORD) return "admin";
  if (value === STAFF_PASSWORD) return "staff";
  return null;
}

// Route prefixes that require admin role
export const ADMIN_ONLY_PREFIXES = ["/finance", "/api/finance"];
