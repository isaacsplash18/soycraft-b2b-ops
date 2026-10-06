"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarContent } from "./sidebar";
import { GlobalSearch } from "./global-search";

export function Header({ role }: { role?: "admin" | "staff" }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <span
        className="shrink-0 text-base font-bold tracking-tight"
        style={{ color: "var(--primary)" }}
      >
        SOYCRAFT{" "}
        <span className="text-muted-foreground font-normal">B2B</span>
      </span>

      <GlobalSearch className="min-w-0 flex-1" />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div onClick={() => setOpen(false)}>
            <SidebarContent role={role} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
