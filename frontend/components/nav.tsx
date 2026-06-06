"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  FolderKanban,
  MapPin,
  FileSignature,
  Files,
  Search,
  ShieldCheck,
  AlertTriangle,
  FileBarChart2,
  MessageSquareText,
  ScrollText,
  ClipboardList,
  Settings,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/", icon: BarChart3 },
    ],
  },
  {
    label: "基础信息",
    items: [
      { label: "Vendors", href: "/vendors", icon: Building2 },
      { label: "Projects", href: "/projects", icon: FolderKanban },
      { label: "Sites", href: "/sites", icon: MapPin },
      { label: "Contracts", href: "/contracts", icon: FileSignature },
      { label: "Documents", href: "/documents", icon: Files },
    ],
  },
  {
    label: "洞察",
    items: [
      { label: "Topic Search", href: "/topic-search", icon: Search },
      { label: "Gap Analysis", href: "/gap-analysis", icon: ShieldCheck },
      { label: "Risk Issues", href: "/risk-issues", icon: AlertTriangle },
      { label: "CEO Briefs", href: "/ceo-briefs", icon: FileBarChart2 },
      { label: "AI Chat", href: "/ai-chat", icon: MessageSquareText },
    ],
  },
  {
    label: "日志",
    items: [
      { label: "AI Logs", href: "/ai-output-logs", icon: ScrollText },
      { label: "Audit Logs", href: "/audit-logs", icon: ClipboardList },
    ],
  },
  {
    label: null,
    items: [
      { label: "Admin Settings", href: "/admin-settings", icon: Settings },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <aside className="min-h-screen w-56 border-r border-line bg-white flex flex-col">
      <div className="px-4 py-5 text-base font-semibold tracking-tight border-b border-line">
        Colo Contract MVP
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-2" : ""}>
            {group.label && (
              <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </div>
            )}
            {group.items.map(({ label, href, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </Link>
              );
            })}
            {gi < NAV_GROUPS.length - 2 && group.label && (
              <div className="mx-3 mt-2 border-b border-slate-100" />
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
