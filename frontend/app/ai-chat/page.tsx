"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function AIChatPage() {
  const [question, setQuestion] = useState("What is the P1 response time commitment?");
  const [contractId, setContractId] = useState("1");
  const [result, setResult] = useState("");
  async function ask() {
    const login = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "admin123" })
    });
    const token = login.ok ? (await login.json()).access_token : "";
    const res = await fetch(`${API_BASE}/ai/chat-with-sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question, contract_id: Number(contractId), topic_key: "p1_response_time" })
    });
    setResult(JSON.stringify(await res.json(), null, 2));
  }
  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold">AI Chat with Sources</h1>
      <div className="mb-4 grid max-w-2xl gap-2">
        <input className="rounded-md border border-line px-3 py-2" value={contractId} onChange={(e) => setContractId(e.target.value)} />
        <textarea className="rounded-md border border-line px-3 py-2" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button className="w-fit rounded-md bg-action px-4 py-2 text-white" onClick={ask}>Ask</button>
      </div>
      <pre className="overflow-auto rounded-md border border-line bg-white p-4 text-xs">{result}</pre>
    </section>
  );
}
