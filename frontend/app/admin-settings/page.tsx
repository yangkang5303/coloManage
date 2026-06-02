export default function Page() {
  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold">Admin Settings</h1>
      <div className="rounded-md border border-line bg-white p-4 text-sm">
        Configure environment variables in `.env`: LLM_BASE_URL, LLM_API_KEY, model names, database URL, storage path, and CORS origins.
      </div>
    </section>
  );
}
