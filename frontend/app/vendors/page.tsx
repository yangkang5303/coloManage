"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { Plus, Trash2, X } from "lucide-react";

interface Vendor {
  id: number;
  name: string;
  description: string | null;
  country: string | null;
  created_at: string;
}

export default function Page() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", country: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await apiGet("/vendors");
      setVendors(data);
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
      await apiPost("/vendors", {
        name: form.name,
        description: form.description || null,
        country: form.country || null,
      });
      setForm({ name: "", description: "", country: "" });
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
        <h1 className="text-2xl font-semibold">Vendors</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Vendor
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Vendor</h2>
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
                  placeholder="Vendor name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Country</label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. TH, US, SG"
                />
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

      {/* Vendor List */}
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">ID</th>
              <th className="px-4 py-3 font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 font-medium text-slate-600">Description</th>
              <th className="px-4 py-3 font-medium text-slate-600">Country</th>
              <th className="px-4 py-3 font-medium text-slate-600">Created</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500">{v.id}</td>
                <td className="px-4 py-3 font-medium">{v.name}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">{v.description || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{v.country || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(v.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No vendors yet. Click "Add Vendor" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}