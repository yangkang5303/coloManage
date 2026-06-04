"use client";

import { useState, useEffect, useRef } from "react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { X, Play, Upload, CheckCircle, AlertCircle, Loader2, Trash2 } from "lucide-react";

interface Document {
  id: number;
  title: string;
  document_type: string;
  vendor_id: number | null;
  project_id: number | null;
  site_id: number | null;
  contract_id: number | null;
  original_filename: string | null;
  processing_status: string;
  uploaded_at: string;
}

interface Vendor { id: number; name: string; }
interface Project { id: number; name: string; }
interface Site { id: number; name: string; }
interface Contract { id: number; title: string; }

const docTypeOptions = ["RFP", "PROPOSAL", "CONTRACT", "SLA", "RATE_CARD", "INVOICE"];

const statusColors: Record<string, string> = {
  uploaded: "bg-yellow-100 text-yellow-700",
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  processed: "bg-green-100 text-green-700",
  ready: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  OCR_NOT_SUPPORTED_IN_MVP: "bg-orange-100 text-orange-700",
};

/** 判断文档是否已处理完成（后端返回 "processed" 或 "ready"） */
function isProcessed(status: string): boolean {
  return status === "processed" || status === "ready";
}

export default function Page() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    document_type: "CONTRACT",
    vendor_id: "",
    project_id: "",
    site_id: "",
    contract_id: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const [docs, vendorsData, projectsData, sitesData, contractsData] = await Promise.all([
        apiGet("/documents"),
        apiGet("/vendors"),
        apiGet("/projects"),
        apiGet("/sites"),
        apiGet("/contracts"),
      ]);
      setDocuments(docs);
      setVendors(vendorsData);
      setProjects(projectsData);
      setSites(sitesData);
      setContracts(contractsData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("document_type", form.document_type);
      if (form.vendor_id) formData.append("vendor_id", form.vendor_id);
      if (form.project_id) formData.append("project_id", form.project_id);
      if (form.site_id) formData.append("site_id", form.site_id);
      if (form.contract_id) formData.append("contract_id", form.contract_id);
      formData.append("file", file);

      await apiPost("/documents/upload", formData, true);
      setForm({ title: "", document_type: "CONTRACT", vendor_id: "", project_id: "", site_id: "", contract_id: "" });
      setFile(null);
      setShowForm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleProcess(docId: number) {
    setProcessingId(docId);
    setError("");
    try {
      await apiPost(`/documents/${docId}/process`, {});
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDelete(doc: Document) {
    if (!window.confirm(`Delete “${doc.title}” and its processed chunks? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    setError("");
    try {
      await apiDelete(`/documents/${doc.id}`);
      setDocuments((current) => current.filter((item) => item.id !== doc.id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="py-12 text-center text-slate-500">Loading...</div>;

  return (
    <section className="max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Document Library</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Upload Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Upload Document</h2>
              <button onClick={() => { setShowForm(false); setFile(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Document title"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Document Type</label>
                <select
                  value={form.document_type}
                  onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {docTypeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Site</label>
                  <select
                    value={form.site_id}
                    onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- None --</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Contract</label>
                  <select
                    value={form.contract_id}
                    onChange={(e) => setForm({ ...form, contract_id: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- None --</option>
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">File *</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                  accept=".txt,.pdf,.docx,.xlsx,.csv"
                />
                {file && (
                  <p className="mt-1 text-xs text-slate-500">Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                )}
                <p className="mt-1 text-xs text-slate-400">Supported: .txt, .pdf, .docx, .xlsx, .csv</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFile(null); }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !file}
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" /> Upload
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document List */}
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">ID</th>
              <th className="px-4 py-3 font-medium text-slate-600">Title</th>
              <th className="px-4 py-3 font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 font-medium text-slate-600">File</th>
              <th className="px-4 py-3 font-medium text-slate-600">Contract</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Uploaded</th>
              <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500">{doc.id}</td>
                <td className="px-4 py-3 font-medium">{doc.title}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {doc.document_type}
                  </span>
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">
                  {doc.original_filename || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {contracts.find((c) => c.id === doc.contract_id)?.title || "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${statusColors[doc.processing_status] || "bg-gray-100 text-gray-700"}`}>
                    {isProcessed(doc.processing_status) && <CheckCircle className="h-3 w-3" />}
                    {doc.processing_status === "error" && <AlertCircle className="h-3 w-3" />}
                    {doc.processing_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(doc.uploaded_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                  {!isProcessed(doc.processing_status) && doc.processing_status !== "error" && (
                    <button
                      onClick={() => handleProcess(doc.id)}
                      disabled={processingId === doc.id}
                      className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      title="Parse & chunk document"
                    >
                      {processingId === doc.id ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Processing...</>
                      ) : (
                        <><Play className="h-3 w-3" /> Process</>
                      )}
                    </button>
                  )}
                  {isProcessed(doc.processing_status) && (
                    <span className="text-xs text-green-600">Processed</span>
                  )}
                  {doc.processing_status === "error" && (
                    <span className="text-xs text-red-600">Error</span>
                  )}
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title="Delete document and related chunks"
                  >
                    {deletingId === doc.id ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Deleting...</>
                    ) : (
                      <><Trash2 className="h-3 w-3" /> Delete</>
                    )}
                  </button>
                  </div>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No documents yet. Click "Upload Document" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Info Card */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-blue-900">How it works</h3>
        <ol className="list-inside list-decimal space-y-1 text-xs text-blue-800">
          <li>Click <strong>"Upload Document"</strong> to upload a file (.txt, .pdf, .docx, .xlsx, .csv)</li>
          <li>After upload, click <strong>"Process"</strong> to parse the document and split it into chunks</li>
          <li>Once status shows <strong>"ready"</strong>, the document is available for topic search and AI analysis</li>
          <li>Link documents to Contracts, Vendors, Projects, or Sites for organized management</li>
        </ol>
      </div>
    </section>
  );
}