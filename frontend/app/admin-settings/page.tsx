"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";

interface AdminSettings {
  llm: {
    base_url: string;
    api_key_set: boolean;
    small_model: string;
    medium_model: string;
    timeout_seconds: number;
  };
  database: { url: string };
  storage: { dir: string };
  cors: { origins: string[] };
  embedding: { model: string; dim: number; enabled: boolean };
  search: { candidate_limit: number };
  auth: { access_token_expire_minutes: number };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="w-56 px-4 py-3 text-sm font-medium text-slate-600">{label}</td>
      <td className="px-4 py-3 text-sm text-slate-800">{value}</td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left">
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet("/admin/settings")
      .then(setSettings)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-12 text-center text-slate-500">Loading...</div>;

  if (error) return (
    <section className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">Admin Settings</h1>
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
    </section>
  );

  if (!settings) return null;

  return (
    <section className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Settings</h1>
        <span className="text-xs text-slate-400">Read-only — edit via <code className="rounded bg-slate-100 px-1">.env</code></span>
      </div>

      <Section title="LLM Gateway">
        <Row label="Base URL" value={<code className="rounded bg-slate-100 px-1 text-xs">{settings.llm.base_url}</code>} />
        <Row label="API Key" value={
          settings.llm.api_key_set
            ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Set</span>
            : <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Not set (using default)</span>
        } />
        <Row label="Small Model" value={<code className="rounded bg-slate-100 px-1 text-xs">{settings.llm.small_model}</code>} />
        <Row label="Medium Model" value={<code className="rounded bg-slate-100 px-1 text-xs">{settings.llm.medium_model}</code>} />
        <Row label="Timeout" value={`${settings.llm.timeout_seconds}s`} />
      </Section>

      <Section title="Database">
        <Row label="URL" value={<code className="rounded bg-slate-100 px-1 text-xs">{settings.database.url}</code>} />
      </Section>

      <Section title="Storage">
        <Row label="Directory" value={<code className="rounded bg-slate-100 px-1 text-xs">{settings.storage.dir}</code>} />
      </Section>

      <Section title="CORS">
        <Row label="Allowed Origins" value={
          <div className="flex flex-wrap gap-1">
            {settings.cors.origins.map((o) => (
              <code key={o} className="rounded bg-slate-100 px-1 text-xs">{o}</code>
            ))}
          </div>
        } />
      </Section>

      <Section title="Embedding">
        <Row label="Model" value={<code className="rounded bg-slate-100 px-1 text-xs">{settings.embedding.model}</code>} />
        <Row label="Dimensions" value={settings.embedding.dim} />
        <Row label="Enabled" value={
          settings.embedding.enabled
            ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Yes</span>
            : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">No</span>
        } />
      </Section>

      <Section title="Search">
        <Row label="Candidate Limit" value={
          <span>{settings.search.candidate_limit} <span className="text-xs text-slate-400">chunks loaded per query for ranking</span></span>
        } />
      </Section>

      <Section title="Auth">
        <Row label="Token Expiry" value={`${settings.auth.access_token_expire_minutes} minutes`} />
      </Section>
    </section>
  );
}
