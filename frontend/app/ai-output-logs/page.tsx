"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";

interface AiOutputLog {
  id: number;
  task_type: string;
  model_name: string;
  prompt_version: string;
  confidence_score: number;
  human_review_required: boolean;
  output_json: Record<string, unknown> | null;
  cited_chunk_ids: number[];
  created_at: string;
}

export default function Page() {
  const [logs, setLogs] = useState<AiOutputLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet("/ai-output-logs")
      .then(setLogs)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-12 text-center text-slate-500">Loading...</div>;

  return (
    <section className="max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Output Logs</h1>
        <span className="text-sm text-slate-500">{logs.length} records</span>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">ID</th>
              <th className="px-4 py-3 font-medium text-slate-600">Task Type</th>
              <th className="px-4 py-3 font-medium text-slate-600">Model</th>
              <th className="px-4 py-3 font-medium text-slate-600">Version</th>
              <th className="px-4 py-3 font-medium text-slate-600">Confidence</th>
              <th className="px-4 py-3 font-medium text-slate-600">Summary</th>
              <th className="px-4 py-3 font-medium text-slate-600">Review</th>
              <th className="px-4 py-3 font-medium text-slate-600">Created</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500">{log.id}</td>
                <td className="px-4 py-3 font-medium">{log.task_type}</td>
                <td className="px-4 py-3 text-slate-600">{log.model_name}</td>
                <td className="px-4 py-3 text-slate-600">{log.prompt_version}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(log.confidence_score * 100).toFixed(0)}%
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">
                  {(log.output_json as any)?.summary ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {log.human_review_required ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Required
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      OK
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(log.created_at + "Z").toLocaleString()}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No AI output logs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
