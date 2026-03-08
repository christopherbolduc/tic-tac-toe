## Spec

## Goal
Build a more impressive tic-tac-toe experience with these features:
- Difficulty levels (`Easy`, `Medium`, `Hard`)
- Score tracking and streaks with persistence
- Polished game-state animations
- Best-of-N match mode
- Accessibility improvements
- Player personalization
- Lightweight analytics panel
- Local PvP mode

Use strict TDD for each `next` step: one failing test, minimal implementation, green tests, then check off one item.

## Phase 1 - Core Game Systems (logic first)

### Step 1 - Game Mode Foundation (PvC/PvP)
- [x] Add a game mode setting in state with values `pvc` (default) and `pvp`.
- [x] In `pvp` mode, alternate turns between `X` and `O` without AI moves.
- [x] Keep existing PvC behavior unchanged when mode is `pvc`.
- [x] Add/verify mode switch control wiring in UI and reset flow.

### Step 2 - Difficulty Levels
- [x] Add difficulty setting in state with values `easy`, `medium`, `hard` (default `medium`).
- [x] Implement `easy` AI as legal random move selection.
- [x] Implement `medium` AI as current heuristic behavior.
- [x] Implement `hard` AI using minimax (never loses when playing optimally).
- [x] Ensure difficulty only affects PvC mode and is ignored in PvP mode.

### Step 3 - Scoreboard + Persistence
- [x] Add scoreboard state for `playerWins`, `computerWins`, `draws`, `currentStreak`, `bestStreak`.
- [x] Update scoreboard counts correctly after each completed round in PvC mode.
- [x] Track streak: increment on player win, reset on player loss/draw.
- [x] Persist scoreboard and selected settings to `localStorage`.
- [x] Load persisted scoreboard/settings on app init with safe fallback defaults.
- [x] Add "reset stats" action that clears in-memory and persisted stats.

## Phase 2 - Match and Personalization

### Step 4 - Best-of-N Match Mode
- [x] Add match length setting with values `single`, `bo3`.
- [x] Track match round wins separately from lifetime stats.
- [x] End match when either side reaches required wins.
- [x] Display clear match winner message and prevent additional round input until next match starts.
- [x] Add "new match" action that resets only match-round state (not lifetime stats).

### Step 5 - Player Personalization
- [x] Add player name input with non-empty trim/default fallback (e.g. `Player`).
- [x] Add marker choice (`X` or `O`) for player in PvC mode.
- [x] If player chooses `O`, computer starts as `X` and turn/status text reflects that.
- [x] Persist name and marker preference to `localStorage`.
- [x] Update status/result strings to use player name where appropriate.

### Step 6 - Local PvP Polish
- [x] Add second player name input for PvP mode (fallback `Player 2`).
- [x] Show turn text with active player name + marker in PvP mode.
- [x] Show winner text with winning player name in PvP mode.
- [x] Keep controls/messages stable when switching between PvC and PvP.

## Phase 3 - UX, Accessibility, and Observability

### Step 7 - Accessibility Upgrades
- [x] Add keyboard navigation for board cells (arrow keys move focus, Enter/Space plays move).
- [x] Preserve visible focus indicator with accessible contrast.
- [x] Ensure status region announces turn changes, invalid move feedback, and outcomes.
- [x] Add/verify semantic labels for all controls (mode, difficulty, match length, reset actions).

### Step 8 - Animations and Visual Feedback
- [x] Add subtle per-move cell pop-in animation.
- [x] Add end-state animation variants for player win, computer win, draw.
- [x] Add turn-transition animation/state cue that does not block input.
- [x] Respect reduced-motion preference by disabling non-essential animation.

### Step 9 - Lightweight Analytics
- [x] Add analytics counters for total rounds and total moves.
- [x] Compute average moves per round.
- [x] Compute first-player win rate (where applicable to mode).
- [x] Display analytics in a compact panel with safe defaults before any games.
- [x] Persist analytics and reset with a dedicated action (or combined with stats reset by design decision + test).

## Manual Browser Checklist (post-Step-9 focus)
- [x] Mobile layout remains usable for all new controls.
- [x] Desktop layout keeps visual hierarchy clean and non-cluttered.
- [x] Keyboard-only play is possible end-to-end in both PvC and PvP.
- [x] `Hard` AI does not lose in repeated manual trials.
- [x] Match flow (`single/bo3`) shows correct winner and reset behavior.
- [x] Persisted settings/stats restore correctly after page reload.
