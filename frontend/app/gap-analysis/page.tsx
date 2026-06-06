"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

const DEFAULT_TOPICS = [
  { key: "p1_response_time", label: "P1 响应时间" },
  { key: "price_escalation", label: "价格调整条款" },
  { key: "expansion_right", label: "扩容权利" },
  { key: "sla_credit", label: "SLA 赔偿" },
  { key: "remote_hands", label: "远程协助" },
  { key: "smart_hands", label: "现场支持" },
];

const RISK_COLORS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

interface Contract { id: number; title: string; }
interface GapResult {
  topic_key: string;
  contract_id: number;
  status?: string;
  error?: string;
  [key: string]: any;
}

export default function GapAnalysisPage() {
  const [contractId, setContractId] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [topicKey, setTopicKey] = useState(DEFAULT_TOPICS[0].key);
  const [result, setResult] = useState<GapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    apiGet("/contracts")
      .then((data: Contract[]) => {
        setContracts(data);
        if (data.length > 0) setContractId(String(data[0].id));
      })
      .catch(() => {});
  }, []);

  async function run() {
    if (!contractId) { setError("请选择合同"); return; }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await apiPost("/gap-analysis/run-topic", {
        topic_key: topicKey,
        contract_id: Number(contractId),
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message || "请求失败");
    } finally {
      setLoading(false);
    }
  }

  const topicLabel = DEFAULT_TOPICS.find((t) => t.key === topicKey)?.label ?? topicKey;
  const contractTitle = contracts.find((c) => c.id === Number(contractId))?.title ?? contractId;

  return (
    <section className="max-w-5xl">
      <h1 className="mb-6 text-2xl font-semibold">Gap Analysis</h1>

      {/* Controls */}
      <div className="mb-6 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">合同</label>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
          >
            {contracts.length === 0 && <option value="">暂无合同</option>}
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">话题</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={topicKey}
              onChange={(e) => setTopicKey(e.target.value)}
            >
              {DEFAULT_TOPICS.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={run}
            disabled={loading || !contractId}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ height: "38px" }}
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> 分析中…</> : "Run"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
          正在分析合同 <strong>{contractTitle}</strong> — 话题：<strong>{topicLabel}</strong>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Summary header */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-slate-700">{topicLabel}</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">{contractTitle}</span>
              {result.risk_level && (
                <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${RISK_COLORS[result.risk_level] ?? "bg-slate-100 text-slate-600"}`}>
                  {result.risk_level} Risk
                </span>
              )}
              {result.coverage_score != null && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  Coverage {Math.round(result.coverage_score * 100)}%
                </span>
              )}
            </div>

            {result.summary && (
              <p className="text-sm text-slate-800 leading-relaxed">{result.summary}</p>
            )}
            {result.finding && (
              <p className="text-sm text-slate-800 leading-relaxed">{result.finding}</p>
            )}
          </div>

          {/* Gaps / obligations */}
          {Array.isArray(result.gaps) && result.gaps.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Gaps ({result.gaps.length})</h3>
              <ul className="space-y-2">
                {result.gaps.map((gap: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-400" />
                    {typeof gap === "string" ? gap : JSON.stringify(gap)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw JSON toggle */}
          <div className="rounded-lg border border-slate-100">
            <button
              className="flex w-full items-center justify-between px-4 py-3 text-xs text-slate-500 hover:bg-slate-50"
              onClick={() => setShowRaw((v) => !v)}
            >
              <span>Raw JSON</span>
              {showRaw ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showRaw && (
              <pre className="overflow-auto border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
