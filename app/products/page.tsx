"use client";

import { Suspense } from "react";
import ProductsBoard from "@/components/products/ProductsBoard";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Spinner } from "@/components/ui/spinner";

export default function ProductsPage() {
  const { t, jiraUrl, jiraConnected } = useJiraApp();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-pretty">
          {t.tabProducts}
        </h2>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
          </div>
        }
      >
        <ProductsBoard jiraUrl={jiraUrl} jiraConnected={jiraConnected} />
      </Suspense>
    </div>
  );
}
