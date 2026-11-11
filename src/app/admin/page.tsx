"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";

export default function AdminPage() {
  const router = useRouter();

  return (
    <AdminDashboard
      onSwitchToPortal={() => router.push("/")}
    />
  );
}
