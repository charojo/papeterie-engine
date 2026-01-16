import os
import re

SEARCH_DIR = "src/web/src"
HEX_COLOR_REGEX = r"#[0-9a-fA-F]{3,6}"
RGBA_REGEX = r"rgba\("
INLINE_STYLE_REGEX = r"style=\{\{"

print("Analyzing CSS compliance in " + SEARCH_DIR)

files_with_issues = []
consolidation_opportunities = {}

for root, dirs, files in os.walk(SEARCH_DIR):
    for file in files:
        if not file.endswith((".jsx", ".js")):
            continue

        filepath = os.path.join(root, file)

        with open(filepath, "r") as f:
            try:
                content = f.read()
            except UnicodeDecodeError:
                continue

        # Check for hardcoded colors
        hex_matches = re.finditer(HEX_COLOR_REGEX, content)
        rgba_matches = re.finditer(RGBA_REGEX, content)

        colors_found = set()
        for m in hex_matches:
            # simple heuristic to avoid css files or valid var usage if any (though var uses --)
            # and ignore some likely non-color hashes (e.g. part of urls usually don't look like
            # valid concise hex but maybe)

            # Actually standard hex regex is fine for now.
            colors_found.add(m.group(0))

        for m in rgba_matches:
            colors_found.add("rgba(...)")

        # Check for inline styles
        inline_style_count = content.count("style={{")

        issues = []
        if colors_found:
            issues.append(
                f"Hardcoded colors: {', '.join(list(colors_found)[:5])}"
                + ("..." if len(colors_found) > 5 else "")
            )

        if inline_style_count > 15:
            issues.append(f"Excessive inline styles ({inline_style_count})")

        if issues:
            files_with_issues.append((filepath, "; ".join(issues)))

        # Consolidation opportunities check (naive)
        # Look for repeated style objects? That's hard with regex.
        # Maybe just count style={{...}} occurrences globally?

print("\n--- Non-Compliant CSS Issues ---")
for f, issue in files_with_issues:
    print(f"| {f} | {issue} | Replace with design tokens / Extract class | Open |")

print("\n--- Consolidation Opportunities (High Inline Style Count) ---")
# Just filtering for high inline style count for now as a proxy for consolidation
sorted_by_styles = []
for root, dirs, files in os.walk(SEARCH_DIR):
    for file in files:
        if not file.endswith((".jsx", ".js")):
            continue
        filepath = os.path.join(root, file)
        with open(filepath, "r") as f:
            try:
                content = f.read()
                count = content.count("style={{")
                if count > 0:
                    sorted_by_styles.append((filepath, count))
            except Exception:
                pass


sorted_by_styles.sort(key=lambda x: x[1], reverse=True)
for f, count in sorted_by_styles[:20]:
    print(
        f"| {os.path.basename(f)} | {count} inline styles | Standardize components / classes | "
        "Open |"
    )
