"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";

interface Site { id: number; name: string; location: string | null; vendor_id: number | null; project_id: number | null; created_at: string; }
interface Vendor { id: number; name: string; }
interface Project { id: number; name: string; }

const emptyForm = { name: "", location: "", vendor_id: "", project_id: "" };

export default function Page() {
  const [sites, setSites] = useState<Site[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Site | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [s, v, p] = await Promise.all([apiGet("/sites"), apiGet("/vendors"), apiGet("/projects")]);
      setSites(s); setVendors(v); setProjects(p);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setEditTarget(null); setForm(emptyForm); setError(""); setShowForm(true); }
  function openEdit(s: Site) {
    setEditTarget(s);
    setForm({ name: s.name, location: s.location ?? "", vendor_id: s.vendor_id?.toString() ?? "", project_id: s.project_id?.toString() ?? "" });
    setError(""); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditTarget(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const body = { name: form.name, location: form.location || null, vendor_id: form.vendor_id ? Number(form.vendor_id) : null, project_id: form.project_id ? Number(form.project_id) : null };
    try {
      editTarget ? await apiPut(`/sites/${editTarget.id}`, body) : await apiPost("/sites", body);
      closeForm(); await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(s: Site) {
    if (!window.confirm(`Delete site "${s.name}"? This cannot be undone.`)) return;
    setDeletingId(s.id);
    try { await apiDelete(`/sites/${s.id}`); setSites((cur) => cur.filter((x) => x.id !== s.id)); }
    catch (e: any) { setError(e.message); }
    finally { setDeletingId(null); }
  }

  if (loading) return <div className="py-12 text-center text-slate-500">Loading...</div>;

  return (
    <section className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sites</h1>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add Site
        </button>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editTarget ? "Edit Site" : "New Site"}</h2>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Site name" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g. Bangkok, Thailand" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Vendor</label>
                  <select value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">-- None --</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
                  <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">-- None --</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
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
              <th className="px-4 py-3 font-medium text-slate-600">Location</th>
              <th className="px-4 py-3 font-medium text-slate-600">Vendor</th>
              <th className="px-4 py-3 font-medium text-slate-600">Project</th>
              <th className="px-4 py-3 font-medium text-slate-600">Created</th>
              <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500">{s.id}</td>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-slate-600">{s.location || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{vendors.find((v) => v.id === s.vendor_id)?.name || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{projects.find((p) => p.id === s.project_id)?.name || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(s.created_at + "Z").toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(s)} className="flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs hover:bg-slate-50">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => handleDelete(s)} disabled={deletingId === s.id} className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
                      {deletingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sites.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No sites yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
