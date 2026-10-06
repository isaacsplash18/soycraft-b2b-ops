"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface SettingsFormProps {
  settings: Record<string, string>;
  action: (data: Record<string, string>) => Promise<{ success: boolean }>;
}

const SETTING_FIELDS = [
  { key: "company_name", label: "Company Name", type: "input" },
  { key: "company_address", label: "Registered Address", type: "textarea" },
  { key: "company_uen", label: "UEN", type: "input" },
  { key: "company_gst_reg", label: "GST Registration No.", type: "input" },
  { key: "company_bank_details", label: "Bank Details (for invoices)", type: "textarea" },
  { key: "gst_rate", label: "GST Rate (decimal, e.g. 0.09 = 9%)", type: "input" },
];

export function SettingsForm({ settings, action }: SettingsFormProps) {
  const [values, setValues] = useState(settings);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await action(values);
      if (result.success) {
        toast.success("Settings saved");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {SETTING_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={field.key}
                  value={values[field.key] || ""}
                  onChange={(e) =>
                    setValues({ ...values, [field.key]: e.target.value })
                  }
                  rows={3}
                />
              ) : (
                <Input
                  id={field.key}
                  value={values[field.key] || ""}
                  onChange={(e) =>
                    setValues({ ...values, [field.key]: e.target.value })
                  }
                />
              )}
            </div>
          ))}
          <Button
            type="submit"
            disabled={isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {isPending ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
