import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "تنظیمات AI",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
