"use client";

import { useRouter } from "next/navigation";

export function BackLink({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.back()} className={className ?? "text-muted hover:text-ink"}>
      ← Back
    </button>
  );
}
