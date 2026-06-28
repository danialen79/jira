import React from 'react';

interface MarkdownPreviewProps {
  text: string;
}

export function MarkdownPreview({ text }: MarkdownPreviewProps) {
  if (!text) return null;

  const lines = text.split('\n');
  let inList = false;
  let listItems: string[] = [];
  const renderedElements: React.ReactNode[] = [];

  const parseInlineStyles = (txt: string) => {
    // Splitting for **bold** text
    const parts = txt.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} className="font-bold text-slate-900">{part}</strong>;
      }
      
      // Splitting for `code` highlights
      const subParts = part.split(/`(.*?)`/g);
      return subParts.map((subPart, subIndex) => {
        if (subIndex % 2 === 1) {
          return (
            <code key={subIndex} className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs border border-slate-200">
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
        <ul key={`list-${key}`} className="list-disc pl-5 mb-3.5 space-y-1.5 text-slate-600 text-sm">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">{parseInlineStyles(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // Check Headers
    if (trimmedLine.startsWith('### ')) {
      flushList(index);
      renderedElements.push(
        <h4 key={index} className="text-sm font-semibold text-slate-900 mt-4 mb-2 uppercase tracking-wide">
          {parseInlineStyles(trimmedLine.slice(4))}
        </h4>
      );
    } else if (trimmedLine.startsWith('## ')) {
      flushList(index);
      renderedElements.push(
        <h3 key={index} className="text-base font-semibold text-slate-900 mt-5 mb-2.5 border-b border-slate-100 pb-1">
          {parseInlineStyles(trimmedLine.slice(3))}
        </h3>
      );
    } else if (trimmedLine.startsWith('# ')) {
      flushList(index);
      renderedElements.push(
        <h2 key={index} className="text-lg font-bold text-slate-900 mt-6 mb-3 border-b border-slate-200 pb-1.5">
          {parseInlineStyles(trimmedLine.slice(2))}
        </h2>
      );
    } else if (/^[-*+]\s+/.test(trimmedLine)) {
      // List items
      inList = true;
      listItems.push(trimmedLine.replace(/^[-*+]\s+/, ''));
    } else if (trimmedLine === '') {
      flushList(index);
    } else {
      flushList(index);
      renderedElements.push(
        <p key={index} className="text-sm text-slate-600 mb-2.5 leading-relaxed whitespace-pre-wrap">
          {parseInlineStyles(line)}
        </p>
      );
    }
  });

  // Flush remaining list items
  flushList(lines.length);

  return <div className="markdown-body font-sans">{renderedElements}</div>;
}
