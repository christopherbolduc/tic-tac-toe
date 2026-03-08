## Overview
This project is a Node.js workspace that will create a simple tic-tac-toe game in HTML, CSS, and JS. The server code works and should not be tampered with. Each time you are prompted, do *only* exactly the tasks requested of you by the user, and be conservative in the changes you make.

## Preferences
- Keep code and explanations clear, practical, and easy to follow.
- Use intentional comments: brief comments before lines/blocks when helpful, plus occasional inline comments if needed.
- Libraries/frameworks are acceptable when they provide clear value.
- Provide concise summaries at the beginning and end, with extra detail only for major changes.
- Ask before making preservation-sensitive changes, especially to existing working code.

## Workflows

When I say "next":
1. Read SPEC.md and find the next unchecked item (- [ ])
2. Write ONE failing test for that item in game.test.js
3. Run the test with !node --test and confirm it fails (red)
4. Implement ONLY what is needed to pass that test in game.js, ai.js, ui.js, main.js, and/or index.html
5. Run !node --test again and confirm it passes (green)
6. Check off the item in SPEC.md (change - [ ] to - [x])

After Step 9 is reached:
1. Continue using "next" with newly added unchecked items in SPEC.md.
2. Prefer finishing implementation items needed to make the manual checklist pass in-browser.
3. Keep the same TDD loop (one failing test, minimal fix, green, then check off).
