import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مصرف AvalAI",
};

export default function AvalaiUsageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
