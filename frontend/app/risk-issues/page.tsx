"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface RiskIssue {
  id: number;
  contract_id: number | null;
  issue_title: string;
  issue_type: string;
  risk_level: string;
  evidence_strength: string;
  ai_assessment: string | null;
  rule_assessment: string | null;
  recommended_next_action: string | null;
  human_review_status: string;
  created_at: string;
}

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  confirmed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  legal_review_requested: "bg-purple-100 text-purple-700",
};

function fmt(iso: string) {
  return new Date(iso + "Z").toLocaleString();
}

export default function RiskIssuesPage() {
  const [issues, setIssues] = useState<RiskIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [actioning, setActioning] = useState<number | null>(null);

  async function load() {
    try {
      const data = await apiGet("/risk-issues?limit=200");
      setIssues(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function doAction(id: number, action: "confirm" | "reject" | "request-legal-review") {
    setActioning(id);
    try {
      await apiPost(`/risk-issues/${id}/${action}`, {});
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActioning(null);
    }
  }

  if (loading) return (
    <section className="max-w-5xl">
      <h1 className="mb-4 text-2xl font-semibold">Risk Issues</h1>
      <div className="text-slate-400 text-sm">Loading...</div>
    </section>
  );

  const highCount = issues.filter((i) => i.risk_level === "HIGH" || i.risk_level === "CRITICAL").length;
  const pendingCount = issues.filter((i) => i.human_review_status === "pending").length;

  return (
    <section className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-semibold">Risk Issues</h1>

      {/* Summary chips */}
      <div className="flex gap-3 text-sm">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">共 {issues.length} 条</span>
        {highCount > 0 && <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">{highCount} HIGH/CRITICAL</span>}
        {pendingCount > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{pendingCount} 待审核</span>}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      {issues.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-400 text-sm">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          暂无风险条目。请先在 Gap Analysis 页面运行分析。
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => {
            const isExpanded = expanded === issue.id;
            return (
              <div key={issue.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  onClick={() => setExpanded(isExpanded ? null : issue.id)}
                >
                  <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${RISK_COLORS[issue.risk_level] ?? "bg-slate-100 text-slate-600"}`}>
                    {issue.risk_level}
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-800 min-w-0 truncate">{issue.issue_title}</span>
                  <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[issue.human_review_status] ?? "bg-slate-100 text-slate-500"}`}>
                    {issue.human_review_status}
                  </span>
                  <span className="flex-shrink-0 text-xs text-slate-400">{fmt(issue.created_at)}</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-500">
                      <div><span className="font-medium text-slate-600">Issue Type:</span> {issue.issue_type}</div>
                      <div><span className="font-medium text-slate-600">Evidence Strength:</span> {issue.evidence_strength}</div>
                      {issue.contract_id && <div><span className="font-medium text-slate-600">Contract ID:</span> {issue.contract_id}</div>}
                    </div>

                    {issue.rule_assessment && (
                      <div>
                        <div className="mb-1 text-xs font-medium text-slate-600">Rule Assessment</div>
                        <p className="text-sm text-slate-700 leading-relaxed">{issue.rule_assessment}</p>
                      </div>
                    )}
                    {issue.ai_assessment && (
                      <div>
                        <div className="mb-1 text-xs font-medium text-slate-600">AI Assessment</div>
                        <p className="text-sm text-slate-700 leading-relaxed">{issue.ai_assessment}</p>
                      </div>
                    )}
                    {issue.recommended_next_action && (
                      <div>
                        <div className="mb-1 text-xs font-medium text-slate-600">Recommended Action</div>
                        <p className="text-sm text-slate-700 leading-relaxed">{issue.recommended_next_action}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {issue.human_review_status === "pending" && (
                      <div className="flex gap-2 pt-1 border-t border-slate-100">
                        <button
                          onClick={() => doAction(issue.id, "confirm")}
                          disabled={actioning === issue.id}
                          className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {actioning === issue.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Confirm
                        </button>
                        <button
                          onClick={() => doAction(issue.id, "reject")}
                          disabled={actioning === issue.id}
                          className="flex items-center gap-1 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => doAction(issue.id, "request-legal-review")}
                          disabled={actioning === issue.id}
                          className="flex items-center gap-1 rounded-md border border-purple-300 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 disabled:opacity-50"
                        >
                          Request Legal Review
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
