"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import {
  Building2,
  FolderKanban,
  MapPin,
  FileSignature,
  Files,
  AlertTriangle,
  Bot,
  Wifi,
  WifiOff,
  Cpu,
  Database,
} from "lucide-react";

interface DashboardData {
  counts: {
    vendors: number;
    projects: number;
    sites: number;
    contracts: number;
    documents: number;
    risk_issues: number;
    high_risk_issues: number;
    pending_review: number;
    ai_calls_total: number;
  };
  system: {
    llm_base_url: string;
    llm_api_key_set: boolean;
    llm_model: string;
    embedding_enabled: boolean;
    database_url: string;
  };
  recent_audit: {
    id: number;
    action: string;
    entity_type: string;
    entity_id: number | null;
    created_at: string;
  }[];
  recent_ai: {
    id: number;
    task_type: string;
    model_name: string | null;
    confidence_score: number | null;
    human_review_required: boolean;
    created_at: string;
  }[];
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  process: "bg-purple-100 text-purple-700",
  upload: "bg-yellow-100 text-yellow-700",
  generate: "bg-indigo-100 text-indigo-700",
  confirmed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function fmt(iso: string) {
  return new Date(iso + "Z").toLocaleString();
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet("/dashboard/summary")
      .then(setData)
      .catch((e: any) => setError(e.message || "Failed to load dashboard"));
  }, []);

  if (error) {
    return (
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Dashboard</h1>
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
      </section>
    );
  }

  if (!data) {
    return (
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Dashboard</h1>
        <div className="text-slate-400 text-sm">Loading...</div>
      </section>
    );
  }

  // Handle old flat format (backend not yet restarted) and new nested format
  const counts: DashboardData["counts"] = data.counts ?? {
    vendors: 0, projects: 0, sites: 0,
    contracts: (data as any).contracts ?? 0,
    documents: (data as any).documents ?? 0,
    risk_issues: (data as any).risk_issues ?? 0,
    high_risk_issues: (data as any).high_risk_issues ?? 0,
    pending_review: 0,
    ai_calls_total: 0,
  };
  const system: DashboardData["system"] = data.system ?? {
    llm_base_url: "", llm_api_key_set: false, llm_model: "",
    embedding_enabled: false, database_url: "",
  };
  const recent_audit = data.recent_audit ?? [];
  const recent_ai = data.recent_ai ?? [];

  const statCards = [
    { label: "Vendors", value: counts.vendors, icon: Building2, href: "/vendors", color: "text-blue-600" },
    { label: "Projects", value: counts.projects, icon: FolderKanban, href: "/projects", color: "text-violet-600" },
    { label: "Sites", value: counts.sites, icon: MapPin, href: "/sites", color: "text-teal-600" },
    { label: "Contracts", value: counts.contracts, icon: FileSignature, href: "/contracts", color: "text-indigo-600" },
    { label: "Documents", value: counts.documents, icon: Files, href: "/documents", color: "text-slate-600" },
    { label: "Risk Issues", value: counts.risk_issues, icon: AlertTriangle, href: "/risk-issues", color: "text-amber-600" },
    { label: "High Risk", value: counts.high_risk_issues, icon: AlertTriangle, href: "/risk-issues", color: "text-red-600" },
    { label: "AI Calls", value: counts.ai_calls_total, icon: Bot, href: "/ai-output-logs", color: "text-purple-600" },
  ];

  return (
    <section className="max-w-6xl space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Stat grid */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, href, color }) => (
          <Link key={label} href={href} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{label}</span>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="mt-2 text-3xl font-semibold">{value}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* System status */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">System Status</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600"><Cpu className="h-4 w-4" /> LLM Gateway</span>
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${system.llm_api_key_set ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {system.llm_api_key_set ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {system.llm_api_key_set ? "Connected" : "No API Key"}
              </span>
            </div>
            {system.llm_model && (
              <div className="flex items-center justify-between text-slate-500">
                <span>Model</span>
                <span className="font-mono text-xs bg-slate-100 rounded px-2 py-0.5 max-w-[180px] truncate">{system.llm_model}</span>
              </div>
            )}
            {system.llm_base_url && (
              <div className="flex items-center justify-between text-slate-500">
                <span>Base URL</span>
                <span className="font-mono text-xs bg-slate-100 rounded px-2 py-0.5 max-w-[180px] truncate">{system.llm_base_url}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600"><Bot className="h-4 w-4" /> Embedding</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${system.embedding_enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {system.embedding_enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600"><Database className="h-4 w-4" /> Database</span>
              <span className="font-mono text-xs bg-slate-100 rounded px-2 py-0.5 max-w-[180px] truncate">{system.database_url}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Pending Review</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${counts.pending_review > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                {counts.pending_review} issues
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <Link href="/admin-settings" className="text-xs text-blue-600 hover:underline">View Admin Settings →</Link>
          </div>
        </div>

        {/* Recent AI calls */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Recent AI Calls</h2>
          {recent_ai.length === 0 ? (
            <p className="text-xs text-slate-400">No AI calls yet.</p>
          ) : (
            <div className="space-y-2">
              {recent_ai.map((r) => (
                <div key={r.id} className="flex items-start justify-between text-xs">
                  <div>
                    <span className="font-medium text-slate-700">{r.task_type}</span>
                    {r.model_name && <span className="ml-1.5 text-slate-400 font-mono">{r.model_name.slice(0, 24)}</span>}
                    {r.confidence_score != null && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${r.confidence_score >= 0.8 ? "bg-green-100 text-green-700" : r.confidence_score >= 0.5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                        {Math.round(r.confidence_score * 100)}%
                      </span>
                    )}
                    {r.human_review_required && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">review</span>}
                    <div className="text-slate-400 mt-0.5">{fmt(r.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <Link href="/ai-output-logs" className="text-xs text-blue-600 hover:underline">View all AI logs →</Link>
          </div>
        </div>
      </div>

      {/* Recent audit log */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Recent Activity</h2>
        {recent_audit.length === 0 ? (
          <p className="text-xs text-slate-400">No activity yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="pb-2 text-left font-medium">Time</th>
                <th className="pb-2 text-left font-medium">Action</th>
                <th className="pb-2 text-left font-medium">Entity</th>
                <th className="pb-2 text-left font-medium">ID</th>
              </tr>
            </thead>
            <tbody>
              {recent_audit.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="py-2 pr-4 text-xs text-slate-500 whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ACTION_COLORS[r.action] || "bg-slate-100 text-slate-600"}`}>
                      {r.action}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-600">{r.entity_type}</td>
                  <td className="py-2 text-xs text-slate-400">{r.entity_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <Link href="/audit-logs" className="text-xs text-blue-600 hover:underline">View all audit logs →</Link>
        </div>
      </div>
    </section>
  );
}
