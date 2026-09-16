import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "سلامت",
};

export default function HealthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
