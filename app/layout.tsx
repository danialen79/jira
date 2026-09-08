import type { Metadata } from "next";
import { Providers } from "@/components/providers/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jira AI Workspace",
  description: "Jira Server AI Refiner & Publisher",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
