"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function AccessPage() {
  return (
    <Suspense>
      <AccessForm />
    </Suspense>
  );
}

function AccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password === "demo-admin" || password === "demo-staff") {
      // Set auth cookie (30 days). Cookie value identifies the role.
      document.cookie = `soycraft_auth=${password}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      const next = searchParams.get("next") || "/dashboard";
      router.push(next);
      router.refresh();
    } else {
      setError(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-white p-8 shadow-sm">
        <div className="flex justify-center">
          <Image
            src="/soycraft-wordmark.png"
            alt="Soycraft"
            width={180}
            height={40}
            priority
          />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Enter the access password to continue
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="Password"
            autoFocus
          />
          {error && (
            <p className="text-sm text-red-500">Incorrect password</p>
          )}
          <Button type="submit" className="w-full">
            Enter
          </Button>
        </form>
      </div>
    </div>
  );
}
