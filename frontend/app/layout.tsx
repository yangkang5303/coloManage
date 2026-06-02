import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Colo Contract MVP",
  description: "AI-assisted contract execution intelligence"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex">
          <Nav />
          <main className="min-h-screen flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
