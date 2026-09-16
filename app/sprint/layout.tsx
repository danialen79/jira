import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "اسپرینت",
};

export default function SprintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
