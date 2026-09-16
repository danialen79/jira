import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "همگام‌سازی اپیک",
};

export default function EpicSyncLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
