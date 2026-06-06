"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { Send, Loader2, CheckCircle, AlertCircle, FileText, ChevronDown, ChevronUp } from "lucide-react";

interface Contract { id: number; title: string; }
interface Citation { document_id: number; chunk_id: number; }
interface ChunkDetail {
  id: number;
  document_id: number;
  document_title: string | null;
  document_type: string | null;
  chunk_index: number;
  section_title: string | null;
  clause_reference: string | null;
  page_number: number | null;
  sheet_name: string | null;
  text: string;
}
interface ChatResult {
  answer?: string;
  summary?: string;
  answer_type?: string;
  citations?: Citation[];
  confidence_score?: number;
  human_review_required?: boolean;
  status?: string;
  error?: string;
}

export default function AIChatPage() {
  const [question, setQuestion] = useState("What is the P1 response time commitment?");
  const [contractId, setContractId] = useState("1");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChatResult | null>(null);
  const [error, setError] = useState("");
  const [expandedChunk, setExpandedChunk] = useState<number | null>(null);
  const [chunkCache, setChunkCache] = useState<Record<number, ChunkDetail>>({});
  const [loadingChunk, setLoadingChunk] = useState<number | null>(null);

  useEffect(() => {
    apiGet("/contracts").then(setContracts).catch(() => {});
  }, []);

  async function ask() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    setExpandedChunk(null);
    setChunkCache({});
    try {
      const data = await apiPost("/ai/chat-with-sources", {
        question,
        contract_id: Number(contractId),
        topic_key: "p1_response_time",
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleChunk(chunkId: number) {
    if (expandedChunk === chunkId) { setExpandedChunk(null); return; }
    setExpandedChunk(chunkId);
    if (chunkCache[chunkId]) return;
    setLoadingChunk(chunkId);
    try {
      const data = await apiGet(`/chunks/${chunkId}`);
      setChunkCache((prev) => ({ ...prev, [chunkId]: data }));
    } catch { /* silently ignore */ }
    finally { setLoadingChunk(null); }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
  }

  const confidencePct = result?.confidence_score != null
    ? Math.round(result.confidence_score * 100)
    : null;

  const isUnavailable = result?.status === "llm_unavailable" || result?.answer_type === "evidence_not_found";

  return (
    <section className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">AI Chat with Sources</h1>
        <p className="mt-1 text-sm text-slate-500">Ask questions grounded in contract evidence. Every answer cites its source chunks.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Contract</label>
          <select
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
            {contracts.length === 0 && <option value="1">Contract #1</option>}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Question <span className="text-slate-400 font-normal">(⌘Enter to submit)</span>
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            placeholder="Ask a question about this contract..."
          />
        </div>

        <button
          onClick={ask}
          disabled={loading || !question.trim()}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Thinking...</>
          ) : (
            <><Send className="h-4 w-4" /> Ask</>
          )}
        </button>
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
          Querying contract evidence and generating answer...
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-md bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && !loading && (
        <div className="mt-6 space-y-4">
          {isUnavailable ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-medium mb-1">
                <AlertCircle className="h-4 w-4" /> LLM Unavailable
              </div>
              {result.summary || result.error || "No answer available."}
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{result.answer_type}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {confidencePct != null && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${confidencePct >= 80 ? "bg-green-100 text-green-700" : confidencePct >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                      {confidencePct}% confidence
                    </span>
                  )}
                  {result.human_review_required && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Review required
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-slate-800 leading-relaxed">
                {result.answer || result.summary || "No answer text."}
              </p>

              {result.citations && result.citations.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-slate-500">
                    <FileText className="h-3.5 w-3.5" />
                    Sources ({result.citations.length}) — click to expand
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.citations.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => toggleChunk(c.chunk_id)}
                        className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                          expandedChunk === c.chunk_id
                            ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Doc {c.document_id} · Chunk {c.chunk_id}
                        {loadingChunk === c.chunk_id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : expandedChunk === c.chunk_id
                            ? <ChevronUp className="h-3 w-3" />
                            : <ChevronDown className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>

                  {expandedChunk !== null && chunkCache[expandedChunk] && (() => {
                    const chunk = chunkCache[expandedChunk];
                    return (
                      <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {chunk.document_title && (
                            <span className="font-medium text-slate-700">{chunk.document_title}</span>
                          )}
                          {chunk.document_type && (
                            <span className="rounded bg-slate-200 px-1.5 py-0.5">{chunk.document_type}</span>
                          )}
                          {chunk.section_title && (
                            <span>§ {chunk.section_title}</span>
                          )}
                          {chunk.clause_reference && (
                            <span>Clause {chunk.clause_reference}</span>
                          )}
                          {chunk.page_number && (
                            <span>p.{chunk.page_number}</span>
                          )}
                          {chunk.sheet_name && (
                            <span>Sheet: {chunk.sheet_name}</span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">{chunk.text}</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
