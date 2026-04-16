import type { Metadata } from "next";
// @ts-ignore — CSS side-effect import
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Canvas — Human Oversight for Agentic AI",
  description:
    "Signal Canvas is the observability layer for agentic AI — making agent decisions transparent, traceable, and governable in high-stakes operational environments. Live demo powered by Claude and Next.js.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="bg-black border-b border-gray-800 px-6 py-4">
          <span className="text-white font-semibold text-lg tracking-tight">
            Signal Canvas
          </span>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
