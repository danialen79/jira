import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "بورد روزانه",
};

export default function DailyBoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
