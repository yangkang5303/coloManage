"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { Loader2, AlertCircle, ChevronDown, ChevronUp, Plus, FileBarChart2 } from "lucide-react";

interface RiskIssue {
  id: number;
  issue_title: string;
  risk_level: string;
  contract_id: number | null;
  human_review_status: string;
}

interface CeoBrief {
  id: number;
  title: string;
  scope_description: string | null;
  brief_markdown: string | null;
  overall_risk_rating: string | null;
  created_at: string;
  source_risk_issue_ids: number[] | null;
}

const RISK_COLORS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  CRITICAL: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

const RATING_COLORS: Record<string, string> = {
  HIGH: "border-red-300 bg-red-50",
  CRITICAL: "border-red-300 bg-red-50",
  MEDIUM: "border-yellow-300 bg-yellow-50",
  LOW: "border-green-300 bg-green-50",
};

function fmt(iso: string) {
  return new Date(iso + "Z").toLocaleString();
}

export default function CeoBriefsPage() {
  const [briefs, setBriefs] = useState<CeoBrief[]>([]);
  const [riskIssues, setRiskIssues] = useState<RiskIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedBrief, setExpandedBrief] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "",
    scope_description: "",
    risk_issue_ids: [] as number[],
  });

  useEffect(() => {
    Promise.all([
      apiGet("/ceo-briefs"),
      apiGet("/risk-issues"),
    ]).then(([b, r]) => {
      setBriefs(b);
      setRiskIssues(r);
    }).catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleIssue(id: number) {
    setForm((f) => ({
      ...f,
      risk_issue_ids: f.risk_issue_ids.includes(id)
        ? f.risk_issue_ids.filter((x) => x !== id)
        : [...f.risk_issue_ids, id],
    }));
  }

  async function generate() {
    if (!form.title.trim()) { setError("请填写报告标题"); return; }
    if (form.risk_issue_ids.length === 0) { setError("请至少选择一个风险条目"); return; }
    setGenerating(true);
    setError("");
    try {
      const brief = await apiPost("/ceo-briefs/generate", {
        title: form.title,
        scope_description: form.scope_description,
        risk_issue_ids: form.risk_issue_ids,
      });
      setBriefs((prev) => [brief, ...prev]);
      setForm({ title: "", scope_description: "", risk_issue_ids: [] });
      setShowForm(false);
      setExpandedBrief(brief.id);
    } catch (e: any) {
      setError(e.message || "生成失败");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return (
    <section className="max-w-4xl">
      <h1 className="mb-4 text-2xl font-semibold">CEO Brief Generator</h1>
      <div className="text-slate-400 text-sm">Loading...</div>
    </section>
  );

  return (
    <section className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">CEO Brief Generator</h1>
        <button
          onClick={() => { setShowForm((v) => !v); setError(""); }}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          生成新简报
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Generate form */}
      {showForm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">新建 CEO 简报</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">报告标题 *</label>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="如：Q3 供应商风险评估简报"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">范围描述</label>
            <textarea
              rows={2}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="如：针对 Vendor Alpha 合同的 SLA 和价格条款分析"
              value={form.scope_description}
              onChange={(e) => setForm({ ...form, scope_description: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              选择风险条目 * <span className="font-normal text-slate-400">（已选 {form.risk_issue_ids.length} 条）</span>
            </label>
            {riskIssues.length === 0 ? (
              <p className="text-xs text-slate-400">暂无风险条目，请先运行 Gap Analysis</p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1 rounded-md border border-slate-200 bg-white p-2">
                {riskIssues.map((issue) => (
                  <label key={issue.id} className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.risk_issue_ids.includes(issue.id)}
                      onChange={() => toggleIssue(issue.id)}
                      className="rounded"
                    />
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${RISK_COLORS[issue.risk_level] ?? "bg-slate-100 text-slate-600"}`}>
                      {issue.risk_level}
                    </span>
                    <span className="text-sm text-slate-700 flex-1">{issue.issue_title}</span>
                    <span className="text-xs text-slate-400">#{issue.id}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> 生成中…</> : "生成简报"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Briefs list */}
      {briefs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-400 text-sm">
          <FileBarChart2 className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          暂无简报。点击"生成新简报"，选择风险条目后自动生成。
        </div>
      ) : (
        <div className="space-y-3">
          {briefs.map((brief) => {
            const expanded = expandedBrief === brief.id;
            const rating = brief.overall_risk_rating?.toUpperCase() ?? "";
            return (
              <div key={brief.id} className={`rounded-lg border bg-white overflow-hidden ${RATING_COLORS[rating] ?? "border-slate-200"}`}>
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setExpandedBrief(expanded ? null : brief.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileBarChart2 className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    <span className="font-medium text-slate-800 truncate">{brief.title}</span>
                    {rating && (
                      <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${RISK_COLORS[rating] ?? "bg-slate-100 text-slate-600"}`}>
                        {rating} Risk
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="text-xs text-slate-400">{fmt(brief.created_at)}</span>
                    {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 px-5 py-4 space-y-3 bg-white">
                    {brief.scope_description && (
                      <p className="text-xs text-slate-500">{brief.scope_description}</p>
                    )}
                    {brief.brief_markdown && (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {brief.brief_markdown}
                      </div>
                    )}
                    {brief.source_risk_issue_ids && brief.source_risk_issue_ids.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                        <span className="text-xs text-slate-400 mr-1">来源风险条目:</span>
                        {brief.source_risk_issue_ids.map((id) => (
                          <span key={id} className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">#{id}</span>
                        ))}
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
