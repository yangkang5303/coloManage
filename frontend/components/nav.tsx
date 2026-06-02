import Link from "next/link";
import { BarChart3, FileText, Search, ShieldAlert, Settings } from "lucide-react";

const links = [
  ["Dashboard", "/", BarChart3],
  ["Vendors", "/vendors", FileText],
  ["Projects", "/projects", FileText],
  ["Sites", "/sites", FileText],
  ["Contracts", "/contracts", FileText],
  ["Documents", "/documents", FileText],
  ["Topic Search", "/topic-search", Search],
  ["Gap Analysis", "/gap-analysis", ShieldAlert],
  ["Risk Issues", "/risk-issues", ShieldAlert],
  ["CEO Briefs", "/ceo-briefs", FileText],
  ["AI Chat", "/ai-chat", Search],
  ["AI Logs", "/ai-output-logs", FileText],
  ["Audit Logs", "/audit-logs", FileText],
  ["Admin Settings", "/admin-settings", Settings]
] as const;

export function Nav() {
  return (
    <aside className="min-h-screen w-64 border-r border-line bg-white p-4">
      <div className="mb-6 text-lg font-semibold">Colo Contract MVP</div>
      <nav className="space-y-1">
        {links.map(([label, href, Icon]) => (
          <Link key={href} href={href} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-panel">
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
