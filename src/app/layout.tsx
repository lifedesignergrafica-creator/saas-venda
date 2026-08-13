import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: "SaaS Venda",
  description: "Gestão de vendas e estoque local-first",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`h-full antialiased ${plusJakarta.variable}`}>
      <body className="min-h-full flex flex-col font-sans bg-[#0b0d17] text-slate-100">
        {children}
      </body>
    </html>
  );
}
