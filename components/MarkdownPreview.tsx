"use client";

import React from "react";

interface MarkdownPreviewProps {
  text: string;
}

export function MarkdownPreview({ text }: MarkdownPreviewProps) {
  if (!text) return null;

  const lines = text.split("\n");
  let inList = false;
  let listItems: string[] = [];
  const renderedElements: React.ReactNode[] = [];

  const parseInlineStyles = (txt: string) => {
    const parts = txt.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <strong key={index} className="font-bold text-foreground">
            {part}
          </strong>
        );
      }

      const subParts = part.split(/`(.*?)`/g);
      return subParts.map((subPart, subIndex) => {
        if (subIndex % 2 === 1) {
          return (
            <code
              key={subIndex}
              className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
            >
              {subPart}
            </code>
          );
        }
        return subPart;
      });
    });
  };

  const flushList = (key: number) => {
    if (listItems.length > 0) {
      renderedElements.push(
        <ul
          key={`list-${key}`}
          className="mb-3.5 flex list-disc flex-col gap-1.5 ps-5 text-sm text-muted-foreground"
        >
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {parseInlineStyles(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("### ")) {
      flushList(index);
      renderedElements.push(
        <h4
          key={index}
          className="mt-4 mb-2 text-sm font-semibold tracking-wide text-foreground uppercase"
        >
          {parseInlineStyles(trimmedLine.slice(4))}
        </h4>
      );
    } else if (trimmedLine.startsWith("## ")) {
      flushList(index);
      renderedElements.push(
        <h3
          key={index}
          className="mt-5 mb-2.5 border-b border-border pb-1 text-base font-semibold text-foreground"
        >
          {parseInlineStyles(trimmedLine.slice(3))}
        </h3>
      );
    } else if (trimmedLine.startsWith("# ")) {
      flushList(index);
      renderedElements.push(
        <h2
          key={index}
          className="mt-6 mb-3 border-b border-border pb-1.5 text-lg font-bold text-foreground"
        >
          {parseInlineStyles(trimmedLine.slice(2))}
        </h2>
      );
    } else if (/^[-*+]\s+/.test(trimmedLine)) {
      inList = true;
      listItems.push(trimmedLine.replace(/^[-*+]\s+/, ""));
    } else if (trimmedLine === "") {
      flushList(index);
    } else {
      flushList(index);
      renderedElements.push(
        <p
          key={index}
          className="mb-2.5 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground"
        >
          {parseInlineStyles(line)}
        </p>
      );
    }
  });

  flushList(lines.length);

  return <div className="markdown-body font-sans">{renderedElements}</div>;
}
