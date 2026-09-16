import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "بک‌لاگ",
};

export default function BacklogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
