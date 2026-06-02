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
      <h1 className="mb-4 text-2xl font-semibold">Dashboard</h1>
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
