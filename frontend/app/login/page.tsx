"use client";

import { useState } from "react";
import { login } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [token, setToken] = useState("");
  return (
    <section className="max-w-md">
      <h1 className="mb-4 text-2xl font-semibold">Login</h1>
      <div className="space-y-3 rounded-md border border-line bg-white p-4">
        <input className="w-full rounded-md border border-line px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded-md border border-line px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="rounded-md bg-action px-4 py-2 text-white" onClick={async () => setToken((await login(email, password)).access_token)}>Login</button>
        {token ? <textarea className="h-28 w-full rounded-md border border-line p-2 text-xs" readOnly value={token} /> : null}
      </div>
    </section>
  );
}
