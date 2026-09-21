import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "کارگاه",
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100dvh-3.5rem-2rem)] min-h-0 flex-col md:h-[calc(100dvh-3.5rem-2.5rem)]">
      {children}
    </div>
  );
}
