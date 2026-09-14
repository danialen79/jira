"use client";

import { useCallback, useMemo, useState } from "react";

export function useIssueSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const selectedKeys = useMemo(() => Array.from(selected), [selected]);

  const isSelected = useCallback(
    (key: string) => selected.has(key),
    [selected]
  );

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback((keys: string[]) => {
    setSelected(new Set(keys));
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const togglePage = useCallback((pageKeys: string[]) => {
    setSelected((prev) => {
      const allSelected =
        pageKeys.length > 0 && pageKeys.every((k) => prev.has(k));
      if (allSelected) {
        const next = new Set(prev);
        pageKeys.forEach((k) => next.delete(k));
        return next;
      }
      const next = new Set(prev);
      pageKeys.forEach((k) => next.add(k));
      return next;
    });
  }, []);

  return {
    selected,
    selectedKeys,
    count: selected.size,
    isSelected,
    toggle,
    selectAll,
    clear,
    togglePage,
  };
}
