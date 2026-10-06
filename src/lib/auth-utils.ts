import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, roleFromCookie, type Role } from "@/lib/roles";

const ADMIN_EMAIL = "admin@example.com";

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

let cachedUser: CurrentUser | null = null;

export async function getCurrentUser(): Promise<CurrentUser> {
  if (cachedUser) return cachedUser;

  const user = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    throw new Error(
      `Admin user '${ADMIN_EMAIL}' not found. Run \`npx prisma db seed\` to create it.`,
    );
  }

  cachedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.toLowerCase(),
  };
  return cachedUser;
}

export async function getCurrentRole(): Promise<Role | null> {
  const store = await cookies();
  const value = store.get(AUTH_COOKIE)?.value;
  return roleFromCookie(value);
}

export async function isAdmin(): Promise<boolean> {
  return (await getCurrentRole()) === "admin";
}
