import Image from "next/image";

export default function RetailerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center gap-3">
          <Image
            src="/soycraft-wordmark.png"
            alt="Soycraft logo"
            width={140}
            height={31}
            className="object-contain"
            priority
          />
          <span className="text-xs text-muted-foreground font-medium border-l pl-3">
            Retailer Portal
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-white mt-auto">
        <div className="mx-auto max-w-4xl px-4 py-4 text-center text-xs text-muted-foreground">
          Soycraft B2B &middot; Retailer Portal
        </div>
      </footer>
    </div>
  );
}
