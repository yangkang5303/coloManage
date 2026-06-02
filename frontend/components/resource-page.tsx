import { apiGet } from "@/lib/api";

export async function ResourcePage({ title, endpoint }: { title: string; endpoint: string }) {
  const data = await apiGet(endpoint);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const keys = rows[0] ? Object.keys(rows[0]).slice(0, 8) : [];
  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold">{title}</h1>
      <div className="overflow-hidden rounded-md border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel">
            <tr>{keys.map((key) => <th key={key} className="px-3 py-2 font-medium">{key}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row: Record<string, unknown>, index: number) => (
              <tr key={index} className="border-t border-line">
                {keys.map((key) => <td key={key} className="max-w-xs truncate px-3 py-2">{String(row[key] ?? "")}</td>)}
              </tr>
            ))}
            {!rows.length ? (
              <tr><td className="px-3 py-6 text-slate-500">No data loaded. Start the backend and seed data.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
