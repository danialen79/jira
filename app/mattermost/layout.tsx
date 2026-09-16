import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مترموست",
};

export default function MattermostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
