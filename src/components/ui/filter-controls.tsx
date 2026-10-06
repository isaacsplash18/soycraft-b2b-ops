"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

// Filter controls that apply themselves — no separate "Filter" button press.
// They live inside a plain GET <form>, so filters stay URL-driven and
// shareable; we just submit the form on change (or debounced, for text).

const controlClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function FilterSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(controlClass, className)}
      onChange={(e) => {
        props.onChange?.(e);
        e.currentTarget.form?.requestSubmit();
      }}
    >
      {children}
    </select>
  );
}

// Instant-submit input for discrete pickers (type="month", type="date").
// Typing into a date field fires change per segment (Chrome emits partial
// years like "0002"), so submission is debounced and skipped until the value
// is empty (cleared) or a plausible complete date.
function isSubmittableDateValue(type: string | undefined, value: string) {
  if (value === "") return true;
  if (type === "date") return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "1900";
  if (type === "month") return /^\d{4}-\d{2}$/.test(value) && value >= "1900";
  return true;
}

export function FilterInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <input
      {...props}
      className={cn(controlClass, className)}
      onChange={(e) => {
        props.onChange?.(e);
        const form = e.currentTarget.form;
        const { value } = e.currentTarget;
        if (timer.current) clearTimeout(timer.current);
        if (!isSubmittableDateValue(props.type, value)) return;
        timer.current = setTimeout(() => form?.requestSubmit(), 400);
      }}
    />
  );
}

export function FilterSearch({
  className,
  debounceMs = 450,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { debounceMs?: number }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <input
      type="search"
      {...props}
      className={cn(controlClass, "px-3", className)}
      onChange={(e) => {
        props.onChange?.(e);
        const form = e.currentTarget.form;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => form?.requestSubmit(), debounceMs);
      }}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        // Enter applies immediately instead of waiting out the debounce.
        if (e.key === "Enter" && timer.current) clearTimeout(timer.current);
      }}
    />
  );
}
