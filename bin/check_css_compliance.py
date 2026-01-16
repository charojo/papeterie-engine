#!/usr/bin/env python3
import os
import re
import sys

SEARCH_DIR = os.path.join(os.path.dirname(__file__), "../src/web/src")
HEX_COLOR_REGEX = r"#[0-9a-fA-F]{3,6}"
RGBA_REGEX = r"rgba\("
INLINE_STYLE_REGEX = r"style=\{\{"
MAX_INLINE_STYLES = 15


def check_css_compliance():
    print(f"Analyzing CSS compliance in {SEARCH_DIR}...")

    files_with_issues = []

    for root, dirs, files in os.walk(SEARCH_DIR):
        for file in files:
            if not file.endswith((".jsx", ".js")):
                continue

            # Skip ThemeManager.js as it contains the centralized fallbacks
            if file == "ThemeManager.js":
                continue

            # Skip test files for hardcoded colors (often used in mock/expect)
            if ".test." in file:
                continue

            filepath = os.path.join(root, file)

            try:
                with open(filepath, "r") as f:
                    content = f.read()
            except UnicodeDecodeError:
                continue

            issues = []

            # Check for hardcoded colors (excluding specific debug files if we want, but for now we
            # report all)

            for line in content.splitlines():
                # Skip template literals which are likely dynamic/samples
                if "${" in line:
                    continue

                # Check for hardcoded hex colors
                hex_matches = list(re.finditer(HEX_COLOR_REGEX, line))
                if hex_matches:
                    colors = [m.group(0) for m in hex_matches]
                    issues.append(f"Hardcoded hex colors found: {', '.join(colors)}")

                if "rgba(" in line or "rgb(" in line:
                    # Double check it's not a template literal (already checked ${ but
                    # maybe others?)

                    issues.append("Hardcoded rgba()/rgb() usage found")

            # Check for inline styles
            inline_style_count = content.count("style={{")
            if inline_style_count > MAX_INLINE_STYLES:
                issues.append(
                    f"Excessive inline styles: {inline_style_count} (Limit: {MAX_INLINE_STYLES})"
                )

            if issues:
                files_with_issues.append((filepath, list(set(issues))))

    if files_with_issues:
        print("\n❌ CSS Compliance Issues Found:")
        for f, issues in files_with_issues:
            rel_path = os.path.relpath(f, os.path.join(os.path.dirname(__file__), ".."))
            print(f"\n📄 {rel_path}:")
            for issue in issues:
                print(f"  - {issue}")
        print("\nPlease fix these issues by using design tokens or moving styles to CSS classes.")
        sys.exit(1)
    else:
        print("\n✅ CSS Compliance Check Passed!")
        sys.exit(0)


if __name__ == "__main__":
    check_css_compliance()
