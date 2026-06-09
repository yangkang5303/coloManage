"use client";

import { Fragment, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

interface TopicOption {
  key: string;
  label: string;
  description: string;
  keywords: string[];
}

interface EvidenceItem {
  chunk_id: number;
  document_id: number;
  document_title: string;
  document_type: string;
  chunk_index: number;
  page_number: number | null;
  sheet_name: string | null;
  section_title: string | null;
  clause_reference: string | null;
  text: string;
  score: number;
  combined_score?: number;
  keyword_score?: number;
  vector_score?: number;
  cosine_score?: number;
  evidence_text?: string;
  document_role?: string;
}

interface ChunkDetail {
  id: number;
  document_id: number;
  document_title: string | null;
  document_type: string | null;
  chunk_index: number;
  page_number: number | null;
  sheet_name: string | null;
  section_title: string | null;
  clause_reference: string | null;
  text: string;
}

interface EvidencePack {
  topic_key: string;
  contract_id: number;
  rfp_evidence: EvidenceItem[];
  proposal_evidence: EvidenceItem[];
  contract_evidence: EvidenceItem[];
  sla_evidence: EvidenceItem[];
  rate_card_evidence: EvidenceItem[];
  other_evidence: EvidenceItem[];
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  RFP: "RFP 需求",
  PROPOSAL: "供应商方案",
  CONTRACT: "已签合同",
  SLA: "SLA 附件",
  AMENDMENT: "补充协议",
  RATE_CARD: "价格表",
};

const DOCUMENT_TYPE_COLORS: Record<string, string> = {
  RFP: "bg-blue-100 text-blue-800",
  PROPOSAL: "bg-green-100 text-green-800",
  CONTRACT: "bg-purple-100 text-purple-800",
  SLA: "bg-red-100 text-red-800",
  AMENDMENT: "bg-orange-100 text-orange-800",
  RATE_CARD: "bg-yellow-100 text-yellow-800",
};

export default function TopicSearchPage() {
  const [topicKey, setTopicKey] = useState("p1_response_time");
  const [contractId, setContractId] = useState("");
  const [keywords, setKeywords] = useState("");
  const [result, setResult] = useState<EvidencePack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [contracts, setContracts] = useState<{ id: number; title: string }[]>([]);
  const [expandedChunkId, setExpandedChunkId] = useState<number | null>(null);
  const [loadingChunkId, setLoadingChunkId] = useState<number | null>(null);
  const [chunkCache, setChunkCache] = useState<Record<number, ChunkDetail>>({});

  useEffect(() => {
    apiGet("/search/topics")
      .then((data: TopicOption[]) => {
        setTopics(data);
        if (data.length > 0) setTopicKey(data[0].key);
      })
      .catch(() => undefined);
    apiGet("/contracts")
      .then((data: { id: number; title: string }[]) => {
        setContracts(data);
        if (data.length > 0) setContractId(String(data[0].id));
      })
      .catch(() => undefined);
  }, []);

  async function run() {
    const customKeywords = keywords.trim();
    if (!contractId) {
      setError("请选择合同");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data: EvidencePack = customKeywords
        ? await apiPost("/search/keyword-topic", {
            keywords: customKeywords,
            contract_id: Number(contractId),
            limit: 50,
          })
        : await apiPost("/search/evidence-pack", {
            topic_key: topicKey,
            contract_id: Number(contractId),
          });
      setResult(data);
      setExpandedChunkId(null);
    } catch (err: any) {
      setError(err.message || "未知错误");
    } finally {
      setLoading(false);
    }
  }

  async function toggleChunk(chunkId: number) {
    if (expandedChunkId === chunkId) {
      setExpandedChunkId(null);
      return;
    }

    setExpandedChunkId(chunkId);
    if (chunkCache[chunkId]) return;

    setLoadingChunkId(chunkId);
    try {
      const data: ChunkDetail = await apiGet(`/chunks/${chunkId}`);
      setChunkCache((prev) => ({ ...prev, [chunkId]: data }));
    } catch (err: any) {
      setError(err.message || "加载原文失败");
      setExpandedChunkId(null);
    } finally {
      setLoadingChunkId(null);
    }
  }

  // 合并所有证据并按得分降序排列
  const allEvidence: EvidenceItem[] = result
    ? [
        ...result.rfp_evidence,
        ...result.proposal_evidence,
        ...result.contract_evidence,
        ...result.sla_evidence,
        ...result.rate_card_evidence,
        ...result.other_evidence,
      ].sort((a, b) => {
        const scoreA = a.combined_score ?? a.score;
        const scoreB = b.combined_score ?? b.score;
        return scoreB - scoreA;
      })
    : [];

  const totalEvidence = allEvidence.length;

  // 获取当前话题的显示标签
  const currentTopicLabel = keywords.trim() || topics.find((t) => t.key === topicKey)?.label || topicKey;
  const currentTopicDesc = topics.find((t) => t.key === topicKey)?.description || "";

  return (
    <section className="max-w-7xl mx-auto">
      <h1 className="mb-6 text-2xl font-semibold">Topic Evidence Search</h1>

      {/* 搜索表单 */}
      <div className="mb-6 space-y-3">
        {/* 第一行：合同选择 */}
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

        {/* 第二行：预设话题 + 自定义关键词 + 搜索按钮 */}
        <div className="flex items-end gap-3">
          <div className="w-56 flex-shrink-0">
            <label className="mb-1 block text-sm font-medium text-slate-700">预设话题</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={topicKey}
              onChange={(e) => { setTopicKey(e.target.value); setKeywords(""); }}
            >
              {topics.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              自定义关键词 <span className="font-normal text-slate-400">（填写后优先于预设话题）</span>
            </label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") run(); }}
              placeholder="如：SLA 可用性 赔偿"
            />
          </div>

          <button
            className="flex-shrink-0 rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ height: "38px" }}
            onClick={run}
            disabled={loading || !contractId}
          >
            {loading ? "搜索中…" : "搜索"}
          </button>
        </div>

        {currentTopicDesc && !keywords.trim() && (
          <p className="text-xs text-slate-400">{currentTopicDesc}</p>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* 统计信息 */}
      {result && !error && (
        <div className="mb-4 flex gap-4 text-sm text-gray-600">
          <span>话题: <strong>{currentTopicLabel}</strong></span>
          <span>合同: <strong>{contracts.find((c) => c.id === result.contract_id)?.title ?? result.contract_id}</strong></span>
          <span>证据总数: <strong>{totalEvidence}</strong></span>
        </div>
      )}

      {/* 证据表格 */}
      {allEvidence.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 w-28">
                  相关度
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 w-28">
                  文档类型
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 w-48">
                  文档标题
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 w-40">
                  章节/条款
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  证据内容
                </th>
              </tr>
            </thead>
            <tbody>
              {allEvidence.map((item, idx) => {
                const displayScore = item.combined_score ?? item.score;
                const sourceText = item.evidence_text || item.text || "";
                const textPreview = sourceText.slice(0, 300);
                const chunk = chunkCache[item.chunk_id];
                const isExpanded = expandedChunkId === item.chunk_id;
                return (
                  <Fragment key={`${item.chunk_id}-${idx}`}>
                    <tr className="border-t border-line hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-action">
                          {displayScore.toFixed(4)}
                        </span>
                        {item.combined_score != null && (
                          <div className="text-xs text-gray-400 mt-1">
                            <div>KW: {item.keyword_score?.toFixed(2)}</div>
                            <div>Cos: {(item.cosine_score ?? item.vector_score)?.toFixed(2)}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            DOCUMENT_TYPE_COLORS[item.document_type] ||
                            "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {DOCUMENT_TYPE_LABELS[item.document_type] || item.document_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {item.document_title}
                        <div className="text-xs text-gray-400 mt-1">
                          {item.page_number != null && `P${item.page_number} `}
                          {item.sheet_name && `${item.sheet_name} `}
                          {item.chunk_index != null && `Chunk #${item.chunk_index}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.section_title || item.clause_reference || "-"}
                      </td>
                      <td className="px-4 py-3 max-w-xl">
                        <pre className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">
                          {textPreview}{sourceText.length > 300 && "…"}
                        </pre>
                        <button
                          type="button"
                          onClick={() => toggleChunk(item.chunk_id)}
                          className="mt-2 rounded border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
                          disabled={loadingChunkId === item.chunk_id}
                        >
                          {loadingChunkId === item.chunk_id
                            ? "加载原文中…"
                            : isExpanded
                              ? "收起原文"
                              : "查看全部原文"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-blue-100 bg-blue-50/60">
                        <td colSpan={5} className="px-4 py-4">
                          {chunk ? (
                            <div className="rounded-md border border-blue-200 bg-white p-4">
                              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="font-semibold text-slate-700">支撑依据 Chunk 原文</span>
                                {chunk.document_title && <span>{chunk.document_title}</span>}
                                {chunk.document_type && <span className="rounded bg-slate-100 px-1.5 py-0.5">{chunk.document_type}</span>}
                                <span>Chunk #{chunk.chunk_index}</span>
                                {chunk.page_number != null && <span>P{chunk.page_number}</span>}
                                {chunk.sheet_name && <span>Sheet: {chunk.sheet_name}</span>}
                                {chunk.section_title && <span>§ {chunk.section_title}</span>}
                                {chunk.clause_reference && <span>Clause {chunk.clause_reference}</span>}
                              </div>
                              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">{chunk.text}</pre>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-500">正在加载完整 chunk 原文…</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 空状态 */}
      {result && totalEvidence === 0 && !error && (
        <div className="rounded-md border border-line p-8 text-center text-gray-500">
          未找到匹配的证据，请尝试其他关键词或预设话题
        </div>
      )}
    </section>
  );
}