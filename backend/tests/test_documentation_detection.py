import unittest

from app.documentation_detection import (
    evaluate_documentation,
    find_documentation_match,
)


def blob(name: str) -> dict[str, str]:
    return {"name": name, "type": "blob"}


def tree(name: str) -> dict[str, str]:
    return {"name": name, "type": "tree"}


class DocumentationDetectionTests(unittest.TestCase):
    def test_detects_lowercase_readme_at_root(self) -> None:
        match = find_documentation_match([blob("readme.md")])
        self.assertIsNotNone(match)
        assert match is not None
        self.assertEqual(match.path, "readme.md")
        self.assertEqual(match.location, "root")

    def test_detects_docs_index_without_root_readme(self) -> None:
        match = find_documentation_match(
            [blob("package.json"), tree("src")],
            [blob("index.md")],
        )
        self.assertIsNotNone(match)
        assert match is not None
        self.assertEqual(match.path, "docs/index.md")
        self.assertEqual(match.expression, "HEAD:docs/index.md")

    def test_prefers_root_readme_over_docs_folder(self) -> None:
        match = find_documentation_match(
            [blob("README.rst")],
            [blob("README.md")],
        )
        self.assertIsNotNone(match)
        assert match is not None
        self.assertEqual(match.location, "root")

    def test_returns_none_when_no_documentation_exists(self) -> None:
        match = find_documentation_match(
            [blob("main.py")],
            [blob("architecture.md")],
        )
        self.assertIsNone(match)

    def test_evaluate_documentation_penalties(self) -> None:
        issues, deduction = evaluate_documentation(None, None, False)
        self.assertEqual(issues, ["No Documentation"])
        self.assertEqual(deduction, 40)

    def test_evaluate_documentation_skips_empty_repositories(self) -> None:
        issues, deduction = evaluate_documentation(None, None, True)
        self.assertEqual(issues, [])
        self.assertEqual(deduction, 0)

    def test_evaluate_weak_documentation(self) -> None:
        match = find_documentation_match([blob("readme.md")])
        issues, deduction = evaluate_documentation(match, "Too short", False)
        self.assertEqual(issues, ["Weak Documentation"])
        self.assertEqual(deduction, 20)


if __name__ == "__main__":
    unittest.main()
