"use client";

import { useEffect, useState } from "react";
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
  const [contractId, setContractId] = useState("1");
  const [keywords, setKeywords] = useState("");
  const [result, setResult] = useState<EvidencePack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topics, setTopics] = useState<TopicOption[]>([]);

  // 从 API 动态加载话题列表
  useEffect(() => {
    apiGet("/search/topics")
      .then((data: TopicOption[]) => {
        setTopics(data);
        if (data.length > 0) setTopicKey(data[0].key);
      })
      .catch(() => undefined);
  }, []);

  async function run() {
    const customKeywords = keywords.trim();
    if (!contractId || Number.isNaN(Number(contractId))) {
      setError("请输入有效的合同 ID");
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
    } catch (err: any) {
      setError(err.message || "未知错误");
    } finally {
      setLoading(false);
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
      <div className="mb-6 flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            合同 ID
          </label>
          <input
            className="rounded-md border border-line px-3 py-2 w-32"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            placeholder="合同 ID"
          />
        </div>
        <div className="flex-1 min-w-[280px]">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            自定义关键词（优先）
          </label>
          <input
            className="rounded-md border border-line px-3 py-2 w-full"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") run(); }}
            placeholder="输入关键词，支持空格或逗号分隔，如：SLA 可用性 赔偿"
          />
          <p className="mt-1 text-xs text-gray-400">结果按关键词匹配分与 cosine 相似度加权排序</p>
        </div>
        <div className="flex-1 min-w-[280px]">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            或选择预设话题
          </label>
          <select
            className="rounded-md border border-line px-3 py-2 w-full bg-white"
            value={topicKey}
            onChange={(e) => setTopicKey(e.target.value)}
          >
            {topics.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          {currentTopicDesc && (
            <p className="mt-1 text-xs text-gray-400">{currentTopicDesc}</p>
          )}
        </div>
        <button
          className="rounded-md bg-action px-6 py-2 text-white hover:opacity-90 disabled:opacity-50"
          onClick={run}
          disabled={loading}
        >
          {loading ? "搜索中..." : "搜索"}
        </button>
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
          <span>合同 ID: <strong>{result.contract_id}</strong></span>
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
                  得分
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
                const textPreview = (item.evidence_text || item.text || "").slice(0, 300);
                return (
                  <tr
                    key={`${item.chunk_id}-${idx}`}
                    className="border-t border-line hover:bg-gray-50"
                  >
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
                        {textPreview}
                        {(item.evidence_text || item.text || "").length > 300 && "…"}
                      </pre>
                    </td>
                  </tr>
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