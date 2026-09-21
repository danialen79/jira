import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "دانش محصول",
};

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
