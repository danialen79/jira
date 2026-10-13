import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ماتریس",
};

export default function MatrixLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
