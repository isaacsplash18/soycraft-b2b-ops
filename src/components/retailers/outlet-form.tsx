"use client";

import { useTransition, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil } from "lucide-react";
import type { ReactElement } from "react";
import type { ActionResult } from "@/app/(admin)/retailers/actions";

export type OutletData = {
  id: string;
  retailerId: string;
  name: string;
  code: string;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  isActive: boolean;
};

interface OutletFormProps {
  retailerId: string;
  outlet?: OutletData;
  action: (data: {
    retailerId: string;
    name: string;
    code: string;
    address?: string;
    contactPerson?: string;
    phone?: string;
  }) => Promise<ActionResult>;
  trigger?: ReactElement;
}

export function OutletForm({ retailerId, outlet, action, trigger }: OutletFormProps) {
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string>();
  const [open, setOpen] = useState(false);

  const isEdit = !!outlet;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const data = {
      retailerId,
      name: fd.get("name") as string,
      code: (fd.get("code") as string) || "",
      address: (fd.get("address") as string) || undefined,
      contactPerson: (fd.get("contactPerson") as string) || undefined,
      phone: (fd.get("phone") as string) || undefined,
    };

    setFieldErrors({});
    setGlobalError(undefined);

    startTransition(async () => {
      const result = await action(data);
      if (result.success) {
        setOpen(false);
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        if (result.error) setGlobalError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            trigger
          ) : (
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="size-4" />
              Add Outlet
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Outlet" : "Add Outlet"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update outlet details."
              : "Create a new outlet for this retailer."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {globalError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {globalError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="outlet-name">Name *</Label>
              <Input
                id="outlet-name"
                name="name"
                defaultValue={outlet?.name ?? ""}
                required
                placeholder="e.g. Clarke Quay"
                aria-invalid={!!fieldErrors.name}
              />
              <FieldError errors={fieldErrors.name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="outlet-code">Code *</Label>
              <Input
                id="outlet-code"
                name="code"
                defaultValue={outlet?.code ?? ""}
                required
                maxLength={5}
                className="uppercase"
                placeholder="e.g. CQ"
                aria-invalid={!!fieldErrors.code}
              />
              <p className="text-xs text-muted-foreground">Max 5 chars</p>
              <FieldError errors={fieldErrors.code} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="outlet-address">Address</Label>
            <Textarea
              id="outlet-address"
              name="address"
              rows={2}
              defaultValue={outlet?.address ?? ""}
              placeholder="Street address"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="outlet-contact">Contact Person</Label>
              <Input
                id="outlet-contact"
                name="contactPerson"
                defaultValue={outlet?.contactPerson ?? ""}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="outlet-phone">Phone</Label>
              <Input
                id="outlet-phone"
                name="phone"
                defaultValue={outlet?.phone ?? ""}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OutletEditTrigger() {
  return (
    <Button variant="ghost" size="icon-sm">
      <Pencil className="size-3.5" />
    </Button>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs text-destructive">{errors.join(", ")}</p>;
}
