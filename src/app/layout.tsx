import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Nova CRM — the calm, fast CRM for revenue teams",
    template: "%s · Nova CRM",
  },
  description:
    "Nova CRM is a refreshingly calm, fast CRM: pipeline, contacts, deals, tasks, automation, campaigns and reports — with a free 14-day trial and a live demo workspace.",
  keywords: [
    "CRM",
    "Nova CRM",
    "sales pipeline",
    "deal management",
    "contacts",
    "sales automation",
    "lead tracking",
    "small business CRM",
    "team workspace",
  ],
  authors: [{ name: "Nova CRM" }],
  openGraph: {
    title: "Nova CRM — the calm, fast CRM for revenue teams",
    description:
      "Pipeline, contacts, deals, tasks, automation, campaigns and reports in one calm workspace. Start free or try the live demo.",
    url: appUrl,
    siteName: "Nova CRM",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Nova CRM — the calm, fast CRM for revenue teams",
    description:
      "Pipeline, contacts, deals, tasks, automation, campaigns and reports in one calm workspace.",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
