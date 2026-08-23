"use client";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { useStore } from "@/lib/store";

export default function DashboardPage() {
  const { assets, liabilities, goals, loaded } = useStore();

  if (!loaded) return null;

  return <DashboardView assets={assets} liabilities={liabilities} goals={goals} />;
}
