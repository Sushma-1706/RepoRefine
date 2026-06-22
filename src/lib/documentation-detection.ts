export type DocLocation = "root" | "docs" | "doc" | "documentation";

export interface TreeEntry {
  name: string;
  type: string;
}

export interface DocumentationMatch {
  path: string;
  fileName: string;
  location: DocLocation;
  expression: string;
}

const README_FILE_PATTERN = /^readme(\.(md|markdown|rst|txt|asciidoc))?$/i;

const DOC_ENTRY_PATTERNS: RegExp[] = [
  /^readme(\.(md|markdown|rst|txt|asciidoc))?$/i,
  /^index\.(md|markdown|rst|html)$/i,
  /^getting[-_]started\.md$/i,
];

const LOCATION_PRIORITY: Record<DocLocation, number> = {
  root: 400,
  docs: 300,
  documentation: 250,
  doc: 200,
};

const EXTENSION_PRIORITY: Record<string, number> = {
  ".md": 30,
  ".markdown": 28,
  ".rst": 25,
  ".txt": 20,
  ".asciidoc": 18,
  "": 15,
};

function blobEntries(entries: TreeEntry[] | null | undefined): TreeEntry[] {
  return (entries ?? []).filter((entry) => entry.type === "blob");
}

function extensionScore(fileName: string): number {
  const lower = fileName.toLowerCase();
  for (const [ext, score] of Object.entries(EXTENSION_PRIORITY)) {
    if (ext === "" && lower === "readme") return score;
    if (ext && lower.endsWith(ext)) return score;
  }
  if (lower.startsWith("index.")) return 22;
  if (lower.includes("getting-started") || lower.includes("getting_started")) return 20;
  return 10;
}

function matchesPattern(fileName: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(fileName));
}

function buildMatch(
  fileName: string,
  location: DocLocation,
  folder?: string
): DocumentationMatch {
  const path = folder ? `${folder}/${fileName}` : fileName;
  return {
    path,
    fileName,
    location,
    expression: `HEAD:${path}`,
  };
}

function candidatesFromEntries(
  entries: TreeEntry[] | null | undefined,
  location: DocLocation,
  patterns: RegExp[],
  folder?: string
): DocumentationMatch[] {
  return blobEntries(entries)
    .filter((entry) => matchesPattern(entry.name, patterns))
    .map((entry) => buildMatch(entry.name, location, folder));
}

export function findDocumentationMatch(
  rootEntries: TreeEntry[] | null | undefined,
  docsEntries?: TreeEntry[] | null,
  docEntries?: TreeEntry[] | null,
  documentationEntries?: TreeEntry[] | null
): DocumentationMatch | null {
  const candidates: DocumentationMatch[] = [
    ...candidatesFromEntries(rootEntries, "root", [README_FILE_PATTERN]),
    ...candidatesFromEntries(docsEntries, "docs", DOC_ENTRY_PATTERNS, "docs"),
    ...candidatesFromEntries(docEntries, "doc", DOC_ENTRY_PATTERNS, "doc"),
    ...candidatesFromEntries(
      documentationEntries,
      "documentation",
      DOC_ENTRY_PATTERNS,
      "documentation"
    ),
  ];

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const locationDelta = LOCATION_PRIORITY[b.location] - LOCATION_PRIORITY[a.location];
    if (locationDelta !== 0) return locationDelta;
    return extensionScore(b.fileName) - extensionScore(a.fileName);
  })[0];
}

export interface DocumentationEvaluation {
  issues: string[];
  scoreDeduction: number;
  match: DocumentationMatch | null;
}

export function evaluateDocumentation(
  match: DocumentationMatch | null,
  content: string | null | undefined,
  isEmpty = false
): DocumentationEvaluation {
  if (isEmpty) {
    return { issues: [], scoreDeduction: 0, match: null };
  }

  if (!match) {
    return {
      issues: ["No Documentation"],
      scoreDeduction: 40,
      match: null,
    };
  }

  const text = content?.trim() ?? "";
  if (text.length === 0) {
    // File exists in the tree but content was unavailable — don't penalize availability.
    return { issues: [], scoreDeduction: 0, match };
  }

  if (text.length < 300) {
    return {
      issues: ["Weak Documentation"],
      scoreDeduction: 20,
      match,
    };
  }

  return { issues: [], scoreDeduction: 0, match };
}
