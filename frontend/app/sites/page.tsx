"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { Plus, X } from "lucide-react";

interface Site {
  id: number;
  name: string;
  location: string | null;
  vendor_id: number | null;
  project_id: number | null;
  created_at: string;
}

interface Vendor { id: number; name: string; }
interface Project { id: number; name: string; }

export default function Page() {
  const [sites, setSites] = useState<Site[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", vendor_id: "", project_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [sitesData, vendorsData, projectsData] = await Promise.all([
        apiGet("/sites"),
        apiGet("/vendors"),
        apiGet("/projects"),
      ]);
      setSites(sitesData);
      setVendors(vendorsData);
      setProjects(projectsData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiPost("/sites", {
        name: form.name,
        location: form.location || null,
        vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
        project_id: form.project_id ? Number(form.project_id) : null,
      });
      setForm({ name: "", location: "", vendor_id: "", project_id: "" });
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-slate-500">Loading...</div>;

  return (
    <section className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sites</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Site
        </button>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Site</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Site name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Bangkok, Thailand"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Vendor</label>
                <select
                  value={form.vendor_id}
                  onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- None --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
                <select
                  value={form.project_id}
                  onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- None --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">ID</th>
              <th className="px-4 py-3 font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 font-medium text-slate-600">Location</th>
              <th className="px-4 py-3 font-medium text-slate-600">Vendor</th>
              <th className="px-4 py-3 font-medium text-slate-600">Project</th>
              <th className="px-4 py-3 font-medium text-slate-600">Created</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500">{s.id}</td>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-slate-600">{s.location || "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {vendors.find((v) => v.id === s.vendor_id)?.name || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {projects.find((p) => p.id === s.project_id)?.name || "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {sites.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No sites yet. Click "Add Site" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}