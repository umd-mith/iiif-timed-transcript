"""Strip the "generated reading copy" banner from the Markdown ACR.

The banner is a note about the Markdown file, addressed to someone reading
the repository. Baking it into the canonical Word document would tell a
reviewer that the document in their hands is a copy of itself.

Usage: python3 scripts/acr-strip-banner.py <in.md> <out.md>
"""

import re
import sys

src = open(sys.argv[1], encoding="utf-8").read()
# Title line, then a blockquote block, then a blank line.
src = re.sub(r"^(# [^\n]*\n)\n(?:> [^\n]*\n)+\n", r"\1\n", src, count=1)
open(sys.argv[2], "w", encoding="utf-8").write(src)
