"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function GapAnalysisPage() {
  const [topicKey, setTopicKey] = useState("p1_response_time");
  const [contractId, setContractId] = useState("1");
  const [result, setResult] = useState("");
  async function run() {
    const login = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "admin123" })
    });
    const token = login.ok ? (await login.json()).access_token : "";
    const res = await fetch(`${API_BASE}/gap-analysis/run-topic`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ topic_key: topicKey, contract_id: Number(contractId) })
    });
    setResult(JSON.stringify(await res.json(), null, 2));
  }
  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold">RFP / Proposal / Contract Gap Analysis</h1>
      <div className="mb-4 flex gap-2">
        <input className="rounded-md border border-line px-3 py-2" value={contractId} onChange={(e) => setContractId(e.target.value)} />
        <input className="rounded-md border border-line px-3 py-2" value={topicKey} onChange={(e) => setTopicKey(e.target.value)} />
        <button className="rounded-md bg-action px-4 py-2 text-white" onClick={run}>Run</button>
      </div>
      <pre className="overflow-auto rounded-md border border-line bg-white p-4 text-xs">{result}</pre>
    </section>
  );
}
