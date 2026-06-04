import Link from "next/link";
import { LogIn } from "lucide-react";
import { apiGet } from "@/lib/api";

export default async function Dashboard() {
  const summary = await apiGet("/dashboard/summary");
  const items = [
    ["Contracts", summary?.contracts ?? "-"],
    ["Documents", summary?.documents ?? "-"],
    ["Risk Issues", summary?.risk_issues ?? "-"],
    ["High Risk", summary?.high_risk_issues ?? "-"]
  ];
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link
          href="/login"
          className="flex items-center gap-2 rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <LogIn className="h-4 w-4" />
          Login
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-md border border-line bg-white p-4">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-3xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
