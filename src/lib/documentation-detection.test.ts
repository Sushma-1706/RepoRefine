import { describe, expect, it } from "vitest";
import {
  evaluateDocumentation,
  findDocumentationMatch,
  TreeEntry,
} from "./documentation-detection";

const blob = (name: string): TreeEntry => ({ name, type: "blob" });
const tree = (name: string): TreeEntry => ({ name, type: "tree" });

describe("findDocumentationMatch", () => {
  it("detects lowercase readme.md at repository root", () => {
    const match = findDocumentationMatch([blob("readme.md")]);
    expect(match).toEqual({
      path: "readme.md",
      fileName: "readme.md",
      location: "root",
      expression: "HEAD:readme.md",
    });
  });

  it("detects README without extension", () => {
    const match = findDocumentationMatch([blob("README")]);
    expect(match?.path).toBe("README");
    expect(match?.location).toBe("root");
  });

  it("detects alternative readme formats", () => {
    expect(findDocumentationMatch([blob("README.rst")])?.path).toBe("README.rst");
    expect(findDocumentationMatch([blob("readme.txt")])?.path).toBe("readme.txt");
  });

  it("prefers root readme over docs folder entries", () => {
    const match = findDocumentationMatch(
      [blob("readme.md")],
      [blob("index.md")]
    );
    expect(match?.location).toBe("root");
    expect(match?.path).toBe("readme.md");
  });

  it("detects docs/index.md when root has no readme", () => {
    const match = findDocumentationMatch(
      [blob("package.json"), tree("src")],
      [blob("index.md"), blob("guide.md")]
    );
    expect(match).toEqual({
      path: "docs/index.md",
      fileName: "index.md",
      location: "docs",
      expression: "HEAD:docs/index.md",
    });
  });

  it("detects documentation/README.md", () => {
    const match = findDocumentationMatch(
      [],
      null,
      null,
      [blob("README.md")]
    );
    expect(match?.path).toBe("documentation/README.md");
    expect(match?.location).toBe("documentation");
  });

  it("returns null when no documentation files exist", () => {
    const match = findDocumentationMatch(
      [blob("package.json"), tree("src")],
      [blob("api.md")]
    );
    expect(match).toBeNull();
  });
});

describe("evaluateDocumentation", () => {
  const sampleMatch = {
    path: "readme.md",
    fileName: "readme.md",
    location: "root" as const,
    expression: "HEAD:readme.md",
  };

  it("does not penalize empty repositories", () => {
    const result = evaluateDocumentation(null, null, true);
    expect(result.issues).toEqual([]);
    expect(result.scoreDeduction).toBe(0);
  });

  it("penalizes repositories without documentation", () => {
    const result = evaluateDocumentation(null, null, false);
    expect(result.issues).toEqual(["No Documentation"]);
    expect(result.scoreDeduction).toBe(40);
  });

  it("does not penalize when documentation file exists but content is unavailable", () => {
    const result = evaluateDocumentation(sampleMatch, null, false);
    expect(result.issues).toEqual([]);
    expect(result.scoreDeduction).toBe(0);
  });

  it("flags weak documentation based on content length", () => {
    const result = evaluateDocumentation(sampleMatch, "Short readme.", false);
    expect(result.issues).toEqual(["Weak Documentation"]);
    expect(result.scoreDeduction).toBe(20);
  });

  it("accepts substantial documentation content", () => {
    const content = "A".repeat(350);
    const result = evaluateDocumentation(sampleMatch, content, false);
    expect(result.issues).toEqual([]);
    expect(result.scoreDeduction).toBe(0);
  });
});
