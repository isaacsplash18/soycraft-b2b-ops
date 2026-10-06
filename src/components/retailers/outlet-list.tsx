"use client";

import { useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { OutletForm, OutletEditTrigger } from "./outlet-form";
import type { OutletData } from "./outlet-form";
import type { ActionResult, OutletInput } from "@/app/(admin)/retailers/actions";

interface OutletListProps {
  retailerId: string;
  outlets: OutletData[];
  createAction: (data: OutletInput) => Promise<ActionResult>;
  updateAction: (
    id: string,
    data: Omit<OutletInput, "retailerId">
  ) => Promise<ActionResult>;
  toggleAction: (id: string) => Promise<ActionResult>;
}

export function OutletList({
  retailerId,
  outlets,
  createAction,
  updateAction,
  toggleAction,
}: OutletListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Outlets</h2>
        <OutletForm retailerId={retailerId} action={createAction} />
      </div>

      {outlets.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed p-12">
          <p className="text-sm text-muted-foreground">
            No outlets yet. Add one to get started.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outlets.map((outlet) => (
                <OutletRow
                  key={outlet.id}
                  outlet={outlet}
                  retailerId={retailerId}
                  updateAction={updateAction}
                  toggleAction={toggleAction}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function OutletRow({
  outlet,
  retailerId,
  updateAction,
  toggleAction,
}: {
  outlet: OutletData;
  retailerId: string;
  updateAction: (
    id: string,
    data: Omit<OutletInput, "retailerId">
  ) => Promise<ActionResult>;
  toggleAction: (id: string) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();

  const boundUpdate = async (data: {
    retailerId: string;
    name: string;
    code: string;
    address?: string;
    contactPerson?: string;
    phone?: string;
  }) => {
    const { name, code, address, contactPerson, phone } = data;
    return updateAction(outlet.id, { name, code, address, contactPerson, phone });
  };

  return (
    <TableRow className={outlet.isActive ? "" : "opacity-50"}>
      <TableCell className="font-medium">{outlet.name}</TableCell>
      <TableCell>
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
          {outlet.code}
        </code>
      </TableCell>
      <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
        {outlet.address || "--"}
      </TableCell>
      <TableCell className="text-sm">
        {outlet.contactPerson || "--"}
        {outlet.phone && (
          <span className="block text-xs text-muted-foreground">
            {outlet.phone}
          </span>
        )}
      </TableCell>
      <TableCell>
        {outlet.isActive ? (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            Active
          </Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            Inactive
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <OutletForm
            retailerId={retailerId}
            outlet={outlet}
            action={boundUpdate}
            trigger={<OutletEditTrigger />}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await toggleAction(outlet.id);
              });
            }}
            className="text-xs"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            {outlet.isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
