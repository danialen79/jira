"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle({ isRtl }: { isRtl?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const label =
    theme === "dark"
      ? isRtl
        ? "تیره"
        : "Dark"
      : theme === "light"
        ? isRtl
          ? "روشن"
          : "Light"
        : isRtl
          ? "سیستم"
          : "System";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="sm" disabled={!mounted} />
        }
      >
        {theme === "dark" ? (
          <Moon data-icon="inline-start" />
        ) : theme === "light" ? (
          <Sun data-icon="inline-start" />
        ) : (
          <Monitor data-icon="inline-start" />
        )}
        <span className="hidden sm:inline">{mounted ? label : "…"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun data-icon="inline-start" />
            {isRtl ? "روشن" : "Light"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon data-icon="inline-start" />
            {isRtl ? "تیره" : "Dark"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Monitor data-icon="inline-start" />
            {isRtl ? "سیستم" : "System"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
