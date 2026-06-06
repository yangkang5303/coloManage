"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  actor_user_id: number;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_SIZE = 20;

const actionColors: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  process: "bg-purple-100 text-purple-700",
  upload: "bg-sky-100 text-sky-700",
};

export default function Page() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    apiGet(`/audit-logs?skip=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`)
      .then((data) => {
        setLogs(data.items);
        setTotal(data.total);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <section className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <span className="text-sm text-slate-500">{total} records total</span>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">ID</th>
              <th className="px-4 py-3 font-medium text-slate-600">Time</th>
              <th className="px-4 py-3 font-medium text-slate-600">Action</th>
              <th className="px-4 py-3 font-medium text-slate-600">Entity</th>
              <th className="px-4 py-3 font-medium text-slate-600">Entity ID</th>
              <th className="px-4 py-3 font-medium text-slate-600">Actor</th>
              <th className="px-4 py-3 font-medium text-slate-600">Changes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No audit logs yet.</td>
              </tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-400">{log.id}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  {new Date(log.created_at + "Z").toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionColors[log.action] ?? "bg-slate-100 text-slate-600"}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{log.entity_type}</td>
                <td className="px-4 py-3 text-slate-600">{log.entity_id}</td>
                <td className="px-4 py-3 text-slate-600">user {log.actor_user_id}</td>
                <td className="max-w-xs px-4 py-3">
                  {log.after_value ? (
                    <code className="block truncate rounded bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600">
                      {JSON.stringify(log.after_value)}
                    </code>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>{from}–{to} of {total}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i).map((i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`min-w-[2rem] rounded-md border px-2 py-1 text-xs ${
                  i === page
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                    : "border-slate-300 hover:bg-slate-50"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
              className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
