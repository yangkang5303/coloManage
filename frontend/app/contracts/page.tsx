"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";

interface Contract { id: number; title: string; vendor_id: number | null; project_id: number | null; site_id: number | null; effective_date: string | null; expiry_date: string | null; status: string; created_at: string; }
interface Vendor { id: number; name: string; }
interface Project { id: number; name: string; }
interface Site { id: number; name: string; }

const statusOptions = ["draft", "active", "expired", "terminated"];
const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-700", active: "bg-green-100 text-green-700", expired: "bg-red-100 text-red-700", terminated: "bg-orange-100 text-orange-700" };
const emptyForm = { title: "", vendor_id: "", project_id: "", site_id: "", effective_date: "", expiry_date: "", status: "draft" };

export default function Page() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Contract | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [c, v, p, s] = await Promise.all([apiGet("/contracts"), apiGet("/vendors"), apiGet("/projects"), apiGet("/sites")]);
      setContracts(c); setVendors(v); setProjects(p); setSites(s);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setEditTarget(null); setForm(emptyForm); setError(""); setShowForm(true); }
  function openEdit(c: Contract) {
    setEditTarget(c);
    setForm({ title: c.title, vendor_id: c.vendor_id?.toString() ?? "", project_id: c.project_id?.toString() ?? "", site_id: c.site_id?.toString() ?? "", effective_date: c.effective_date?.slice(0, 10) ?? "", expiry_date: c.expiry_date?.slice(0, 10) ?? "", status: c.status });
    setError(""); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditTarget(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const body = { title: form.title, vendor_id: form.vendor_id ? Number(form.vendor_id) : null, project_id: form.project_id ? Number(form.project_id) : null, site_id: form.site_id ? Number(form.site_id) : null, effective_date: form.effective_date || null, expiry_date: form.expiry_date || null, status: form.status };
    try {
      editTarget ? await apiPut(`/contracts/${editTarget.id}`, body) : await apiPost("/contracts", body);
      closeForm(); await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(c: Contract) {
    if (!window.confirm(`Delete contract "${c.title}"? This cannot be undone.`)) return;
    setDeletingId(c.id);
    try { await apiDelete(`/contracts/${c.id}`); setContracts((cur) => cur.filter((x) => x.id !== c.id)); }
    catch (e: any) { setError(e.message); }
    finally { setDeletingId(null); }
  }

  if (loading) return <div className="py-12 text-center text-slate-500">Loading...</div>;

  return (
    <section className="max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contracts</h1>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add Contract
        </button>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editTarget ? "Edit Contract" : "New Contract"}</h2>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Contract title" />
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Site</label>
                  <select value={form.site_id} onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">-- None --</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {statusOptions.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Effective Date</label>
                  <input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Expiry Date</label>
                  <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
              <th className="px-4 py-3 font-medium text-slate-600">Title</th>
              <th className="px-4 py-3 font-medium text-slate-600">Vendor</th>
              <th className="px-4 py-3 font-medium text-slate-600">Project</th>
              <th className="px-4 py-3 font-medium text-slate-600">Site</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Effective</th>
              <th className="px-4 py-3 font-medium text-slate-600">Expiry</th>
              <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500">{c.id}</td>
                <td className="px-4 py-3 font-medium">{c.title}</td>
                <td className="px-4 py-3 text-slate-600">{vendors.find((v) => v.id === c.vendor_id)?.name || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{projects.find((p) => p.id === c.project_id)?.name || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{sites.find((s) => s.id === c.site_id)?.name || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColors[c.status] || "bg-gray-100 text-gray-700"}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{c.effective_date ? new Date(c.effective_date).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-slate-500">{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(c)} className="flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs hover:bg-slate-50">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => handleDelete(c)} disabled={deletingId === c.id} className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
                      {deletingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {contracts.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No contracts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
