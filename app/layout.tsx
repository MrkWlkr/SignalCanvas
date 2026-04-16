import type { Metadata } from "next";
// @ts-ignore — CSS side-effect import
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Canvas — Agentic Decision Intelligence",
  description:
    "A live demo of multi-round Claude tool-use agents processing sequential signals and producing structured risk evaluations in real time.",
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
