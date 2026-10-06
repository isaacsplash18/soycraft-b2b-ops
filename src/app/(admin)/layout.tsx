import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { GlobalSearch } from "@/components/layout/global-search";
import { Providers } from "@/components/providers";
import { getCurrentRole } from "@/lib/auth-utils";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = (await getCurrentRole()) ?? undefined;
  return (
    <Providers>
      <div className="flex min-h-screen">
        <Sidebar role={role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header role={role} />
          {/* Desktop top bar */}
          <div className="sticky top-0 z-30 hidden h-14 items-center gap-4 border-b bg-background/80 px-6 backdrop-blur lg:flex">
            <GlobalSearch className="w-full max-w-md" />
          </div>
          <main className="flex-1 p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
