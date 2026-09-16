import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "رودمپ",
};

export default function RoadmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
