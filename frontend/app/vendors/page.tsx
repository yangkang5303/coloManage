"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";

interface Vendor {
  id: number;
  name: string;
  description: string | null;
  country: string | null;
  created_at: string;
}

const emptyForm = { name: "", description: "", country: "" };

export default function Page() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try { setVendors(await apiGet("/vendors")); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(v: Vendor) {
    setEditTarget(v);
    setForm({ name: v.name, description: v.description ?? "", country: v.country ?? "" });
    setError("");
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditTarget(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = { name: form.name, description: form.description || null, country: form.country || null };
    try {
      if (editTarget) {
        await apiPut(`/vendors/${editTarget.id}`, body);
      } else {
        await apiPost("/vendors", body);
      }
      closeForm();
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(v: Vendor) {
    if (!window.confirm(`Delete vendor "${v.name}"? This cannot be undone.`)) return;
    setDeletingId(v.id);
    try { await apiDelete(`/vendors/${v.id}`); setVendors((cur) => cur.filter((x) => x.id !== v.id)); }
    catch (e: any) { setError(e.message); }
    finally { setDeletingId(null); }
  }

  if (loading) return <div className="py-12 text-center text-slate-500">Loading...</div>;

  return (
    <section className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vendors</h1>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add Vendor
        </button>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editTarget ? "Edit Vendor" : "New Vendor"}</h2>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Vendor name" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={3} placeholder="Optional description" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Country</label>
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. TH, US, SG" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeForm} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? "Saving..." : editTarget ? "Save" : "Create"}
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
              <th className="px-4 py-3 font-medium text-slate-600">Description</th>
              <th className="px-4 py-3 font-medium text-slate-600">Country</th>
              <th className="px-4 py-3 font-medium text-slate-600">Created</th>
              <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500">{v.id}</td>
                <td className="px-4 py-3 font-medium">{v.name}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">{v.description || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{v.country || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(v.created_at + "Z").toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(v)} className="flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs hover:bg-slate-50">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => handleDelete(v)} disabled={deletingId === v.id} className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
                      {deletingId === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No vendors yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
