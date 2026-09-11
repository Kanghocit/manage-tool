export type ParsedVocabularyWord = {
  word: string;
  pos: string;
  ipa: string;
  definitionVi: string;
  definitionEn: string;
  examples: { en: string; vi: string }[];
  imageEmoji: string;
};

export type ParseVocabularyResult = {
  words: ParsedVocabularyWord[];
  errors: { block: number; message: string; snippet: string }[];
};

const WORD_HEADER_RE = /^(.+?)\s+\(([^)]+)\)\s+(.+)$/;
const UK_US_RE = /^(UK|US)$/i;
const EXAMPLE_RE = /^(.+?)\s*\(=Dịch:\s*(.+)\)\s*$/i;

function normalizeIpa(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("/") && trimmed.endsWith("/")) return trimmed;
  if (trimmed.startsWith("/")) return `${trimmed}/`;
  return `/${trimmed}/`;
}

function bracketsToBlank(sentence: string): string {
  return sentence.replace(/\[[^\]]+\]/g, "_____").replace(/\s+/g, " ").trim();
}

function splitWordBlocks(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let current: string[] = [];

  const isHeader = (line: string) => WORD_HEADER_RE.test(line.trim());

  for (const line of lines) {
    if (isHeader(line) && current.length > 0) {
      blocks.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.some((l) => l.trim())) {
    blocks.push(current.join("\n"));
  }
  return blocks;
}

function parseBlock(block: string): ParsedVocabularyWord {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) {
    throw new Error("Block trống");
  }

  const headerMatch = lines[0].match(WORD_HEADER_RE);
  if (!headerMatch) {
    throw new Error(`Không nhận dạng được dòng từ: "${lines[0]}"`);
  }

  const word = headerMatch[1].trim();
  const pos = headerMatch[2].trim();
  const ipa = normalizeIpa(headerMatch[3]);

  let i = 1;
  while (i < lines.length && UK_US_RE.test(lines[i])) i += 1;

  while (i < lines.length && !/^Định nghĩa:?/i.test(lines[i])) i += 1;
  if (i >= lines.length) {
    throw new Error(`Thiếu phần "Định nghĩa" cho từ "${word}"`);
  }
  i += 1;

  let definitionVi = "";
  let definitionEn = "";
  if (i < lines.length) {
    const firstDef = lines[i];
    if (firstDef.startsWith("=")) {
      definitionEn = firstDef.slice(1).trim();
      i += 1;
    } else if (firstDef.includes("=")) {
      const eq = firstDef.indexOf("=");
      definitionVi = firstDef.slice(0, eq).trim();
      definitionEn = firstDef.slice(eq + 1).trim();
      i += 1;
    } else {
      definitionVi = firstDef;
      i += 1;
      if (i < lines.length && lines[i].startsWith("=")) {
        definitionEn = lines[i].slice(1).trim();
        i += 1;
      }
    }
  }

  if (!definitionVi || !definitionEn) {
    throw new Error(`Thiếu nghĩa VI/EN cho từ "${word}"`);
  }

  while (i < lines.length && !/^Ví dụ:?/i.test(lines[i])) i += 1;
  if (i < lines.length) i += 1;

  const examples: { en: string; vi: string }[] = [];
  while (i < lines.length) {
    const line = lines[i];
    if (WORD_HEADER_RE.test(line)) break;
    const exMatch = line.match(EXAMPLE_RE);
    if (exMatch) {
      examples.push({
        en: bracketsToBlank(exMatch[1]),
        vi: exMatch[2].trim(),
      });
    }
    i += 1;
  }

  if (!examples.length) {
    examples.push({
      en: `The _____ is related to ${word}.`,
      vi: `Ví dụ với từ ${word}.`,
    });
  }

  return {
    word,
    pos,
    ipa,
    definitionVi,
    definitionEn,
    examples,
    imageEmoji: "📖",
  };
}

export function parseVocabularyPaste(text: string): ParseVocabularyResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { words: [], errors: [] };
  }

  const blocks = splitWordBlocks(trimmed);
  const words: ParsedVocabularyWord[] = [];
  const errors: ParseVocabularyResult["errors"] = [];

  blocks.forEach((block, index) => {
    try {
      words.push(parseBlock(block));
    } catch (err) {
      errors.push({
        block: index + 1,
        message: err instanceof Error ? err.message : "Lỗi không xác định",
        snippet: block.split("\n")[0]?.slice(0, 80) ?? "",
      });
    }
  });

  return { words, errors };
}
