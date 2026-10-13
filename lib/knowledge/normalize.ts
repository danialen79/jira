const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const ZWNJ = /\u200C/g;

const DIGIT_MAP: Record<string, string> = {
  "\u06F0": "0",
  "\u06F1": "1",
  "\u06F2": "2",
  "\u06F3": "3",
  "\u06F4": "4",
  "\u06F5": "5",
  "\u06F6": "6",
  "\u06F7": "7",
  "\u06F8": "8",
  "\u06F9": "9",
  "\u0660": "0",
  "\u0661": "1",
  "\u0662": "2",
  "\u0663": "3",
  "\u0664": "4",
  "\u0665": "5",
  "\u0666": "6",
  "\u0667": "7",
  "\u0668": "8",
  "\u0669": "9",
};

/** Fold Persian/Arabic variants so index and query share one token space. */
export function normalizePersian(text: string): string {
  let out = text.normalize("NFC");
  out = out
    .replace(/\u0643/g, "\u06A9")
    .replace(/\u064A/g, "\u06CC")
    .replace(/\u0649/g, "\u06CC")
    .replace(/\u0629/g, "\u0647");
  out = out.replace(TATWEEL, "");
  out = out.replace(DIACRITICS, "");
  out = out.replace(ZWNJ, "");
  out = out.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (ch) => DIGIT_MAP[ch] || ch);
  out = out.replace(/[ \t]+\n/g, "\n");
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}
