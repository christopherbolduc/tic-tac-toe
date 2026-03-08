(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./game'), require('./ai'), require('./ui'));
    return;
  }

  root.TTTMain = factory(root.TTTGame, root.TTTAi, root.TTTUi);
}(typeof globalThis !== 'undefined' ? globalThis : this, (gameApi, aiApi, uiApi) => {
  const {
    applyMove,
    createGame,
    getWinner,
    isDraw,
    resetGame,
  } = gameApi;
  const { chooseComputerMove } = aiApi;
  const {
    getClickedIndex,
    renderBoardHtml,
    setStatusText,
  } = uiApi;
  const CONFETTI_PIECE_COUNT = 44;
  const CONFETTI_MIN_FALL_MS = 1200;
  const CONFETTI_FALL_VARIANCE_MS = 1400;
  const CONFETTI_CLEANUP_DELAY_MS = 3200;
  const STORAGE_KEY = 'ttt-state';
  const DIFFICULTIES = ['easy', 'medium', 'hard'];
  const MATCH_LENGTHS = ['single', 'bo3'];
  const SCOREBOARD_KEYS = ['playerWins', 'computerWins', 'draws', 'currentStreak', 'bestStreak'];
  const ANALYTICS_KEYS = [
    'totalRounds',
    'totalMoves',
    'averageMovesPerRound',
    'firstPlayerWins',
    'decisiveRounds',
    'firstPlayerWinRate',
  ];
  const MATCH_GAME_COUNTS = {
    single: 1,
    bo3: 3,
  };
  const GAME_NUMBER_WORDS = {
    1: 'One',
    2: 'Two',
    3: 'Three',
  };

  function getDefaultPlayerNameForMode(mode) {
    return mode === 'pvp' ? 'Player 1' : 'Player';
  }

  function syncPlayerOneDefaultNameToMode(game) {
    if (!game) {
      return;
    }
    if (game.mode === 'pvp' && game.playerName === 'Player') {
      game.playerName = 'Player 1';
      return;
    }
    if (game.mode !== 'pvp' && game.playerName === 'Player 1') {
      game.playerName = 'Player';
    }
  }

  function getHumanMark(game) {
    return game.playerMark === 'O' ? 'O' : 'X';
  }

  function getComputerMark(game) {
    return getHumanMark(game) === 'X' ? 'O' : 'X';
  }

  function getPlayerDisplayName(game) {
    return normalizeName(game.playerName, getDefaultPlayerNameForMode(game.mode));
  }

  function getPlayerTwoDisplayName(game) {
    return normalizeName(game.playerTwoName, 'Player 2');
  }

  function getCurrentGameLabel(game) {
    if (game.matchLength === 'single') {
      return 'Single Game';
    }

    const gamesInMatch = MATCH_GAME_COUNTS[game.matchLength] || 1;
    const gameNumber = Math.min(game.matchGamesPlayed + 1, gamesInMatch);
    const word = GAME_NUMBER_WORDS[gameNumber] || String(gameNumber);
    return `Game ${word}`;
  }

  function getBoardForComputerPerspective(board, computerMark) {
    if (computerMark === 'O') {
      return board;
    }

    return board.map((cell) => {
      if (cell === 'X') {
        return 'O';
      }
      if (cell === 'O') {
        return 'X';
      }
      return null;
    });
  }

  function persistGameState(game) {
    const storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
    if (!storage || typeof storage.setItem !== 'function') {
      return;
    }

    storage.setItem(STORAGE_KEY, JSON.stringify({
      mode: game.mode,
      playerName: game.playerName,
      playerTwoName: game.playerTwoName,
      playerMark: game.playerMark,
      difficulty: game.difficulty,
      matchLength: game.matchLength,
      scoreboard: game.scoreboard,
      analytics: game.analytics,
      matchScore: game.matchScore,
      matchGamesPlayed: game.matchGamesPlayed,
      isMatchOver: game.isMatchOver,
      matchWinner: game.matchWinner,
    }));
  }

  function loadPersistedState(game) {
    const storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
    if (!storage || typeof storage.getItem !== 'function') {
      return;
    }

    const raw = storage.getItem(STORAGE_KEY);
    if (typeof raw !== 'string') {
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      return;
    }

    if (parsed && typeof parsed === 'object') {
      if (parsed.mode === 'pvc' || parsed.mode === 'pvp') {
        game.mode = parsed.mode;
      }
      if (typeof parsed.playerName === 'string') {
        game.playerName = parsed.playerName.trim() || getDefaultPlayerNameForMode(game.mode);
      }
      if (typeof parsed.playerTwoName === 'string') {
        game.playerTwoName = parsed.playerTwoName.trim() || 'Player 2';
      }
      if (parsed.playerMark === 'X' || parsed.playerMark === 'O') {
        game.playerMark = parsed.playerMark;
      }
      if (DIFFICULTIES.includes(parsed.difficulty)) {
        game.difficulty = parsed.difficulty;
      }
      if (MATCH_LENGTHS.includes(parsed.matchLength)) {
        game.matchLength = parsed.matchLength;
      }

      const { scoreboard } = parsed;
      if (scoreboard && typeof scoreboard === 'object') {
        SCOREBOARD_KEYS.forEach((key) => {
          const value = scoreboard[key];
          if (Number.isFinite(value) && value >= 0) {
            game.scoreboard[key] = value;
          }
        });
      }

      const { analytics } = parsed;
      if (analytics && typeof analytics === 'object') {
        ANALYTICS_KEYS.forEach((key) => {
          const value = analytics[key];
          if (Number.isFinite(value) && value >= 0) {
            game.analytics[key] = value;
          }
        });
      }

      const { matchScore } = parsed;
      if (matchScore && typeof matchScore === 'object') {
        ['playerWins', 'computerWins'].forEach((key) => {
          const value = matchScore[key];
          if (Number.isFinite(value) && value >= 0) {
            game.matchScore[key] = value;
          }
        });
      }

      const hasPersistedMatchGames = Number.isFinite(parsed.matchGamesPlayed) && parsed.matchGamesPlayed >= 0;
      const hasLegacyMatchProgress = !hasPersistedMatchGames
        && (
          game.matchScore.playerWins > 0
          || game.matchScore.computerWins > 0
          || parsed.isMatchOver === true
          || parsed.matchWinner === 'X'
          || parsed.matchWinner === 'O'
        );

      if (hasPersistedMatchGames) {
        game.matchGamesPlayed = parsed.matchGamesPlayed;
      } else if (hasLegacyMatchProgress) {
        // Compatibility guard: old saves did not store games played, so
        // match progress can be inconsistent with fixed-length match rules.
        resetMatchState(game);
      } else {
        game.matchGamesPlayed = 0;
      }

      if (hasPersistedMatchGames && typeof parsed.isMatchOver === 'boolean') {
        game.isMatchOver = parsed.isMatchOver;
      }
      if (
        hasPersistedMatchGames
        && (parsed.matchWinner === 'X' || parsed.matchWinner === 'O' || parsed.matchWinner === null)
      ) {
        game.matchWinner = parsed.matchWinner;
      }

      const gamesInMatch = MATCH_GAME_COUNTS[game.matchLength] || 1;
      if (game.matchGamesPlayed >= gamesInMatch) {
        game.isMatchOver = true;
        const humanMark = getHumanMark(game);
        const computerMark = getComputerMark(game);
        if (game.matchScore.playerWins > game.matchScore.computerWins) {
          game.matchWinner = humanMark;
        } else if (game.matchScore.computerWins > game.matchScore.playerWins) {
          game.matchWinner = computerMark;
        } else {
          game.matchWinner = null;
        }
      } else {
        game.isMatchOver = false;
        game.matchWinner = null;
      }
    }
  }

  function updatePvcScoreboard(game) {
    if (game.mode !== 'pvc' || !game.scoreboard) {
      return;
    }

    if (game.hasScoredCurrentRound) {
      return;
    }

    const winner = getWinner(game);
    const humanMark = getHumanMark(game);
    const computerMark = getComputerMark(game);
    const roundIsDraw = isDraw(game);
    if (winner === null && !roundIsDraw) {
      return;
    }

    if (winner === humanMark) {
      game.scoreboard.playerWins += 1;
      if (game.matchScore) {
        game.matchScore.playerWins += 1;
      }
      game.scoreboard.currentStreak += 1;
      game.scoreboard.bestStreak = Math.max(
        game.scoreboard.bestStreak,
        game.scoreboard.currentStreak,
      );
    } else if (winner === computerMark) {
      game.scoreboard.computerWins += 1;
      if (game.matchScore) {
        game.matchScore.computerWins += 1;
      }
      game.scoreboard.currentStreak = 0;
    } else if (roundIsDraw) {
      game.scoreboard.draws += 1;
      game.scoreboard.currentStreak = 0;
    }

    game.matchGamesPlayed += 1;
    game.hasScoredCurrentRound = true;

    const gamesInMatch = MATCH_GAME_COUNTS[game.matchLength] || 1;
    if (game.matchGamesPlayed >= gamesInMatch) {
      game.isMatchOver = true;
      if (game.matchScore.playerWins > game.matchScore.computerWins) {
        game.matchWinner = humanMark;
      } else if (game.matchScore.computerWins > game.matchScore.playerWins) {
        game.matchWinner = computerMark;
      } else {
        game.matchWinner = null;
      }
    }
  }

  function updatePvpMatchProgress(game) {
    if (game.mode !== 'pvp') {
      return;
    }

    const winner = getWinner(game);
    const roundIsDraw = isDraw(game);
    if (winner === null && !roundIsDraw) {
      return;
    }

    const gamesInMatch = MATCH_GAME_COUNTS[game.matchLength] || 1;
    if (game.matchGamesPlayed < gamesInMatch) {
      game.matchGamesPlayed += 1;
    }

    if (game.matchLength !== 'single' && game.matchGamesPlayed >= gamesInMatch) {
      game.isMatchOver = true;
    }
  }

  function resetScoreboard(game) {
    SCOREBOARD_KEYS.forEach((key) => {
      game.scoreboard[key] = 0;
    });
  }

  function resetAnalytics(game) {
    ANALYTICS_KEYS.forEach((key) => {
      game.analytics[key] = 0;
    });
  }

  function resetMatchState(game) {
    game.matchScore.playerWins = 0;
    game.matchScore.computerWins = 0;
    game.matchGamesPlayed = 0;
    game.hasScoredCurrentRound = false;
    game.isMatchOver = false;
    game.matchWinner = null;
  }

  function normalizeName(value, fallback) {
    if (typeof value !== 'string') {
      return fallback;
    }
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  function updateAverageMovesPerRound(game) {
    const rounds = game.analytics.totalRounds;
    const moves = game.analytics.totalMoves;
    if (!Number.isFinite(rounds) || rounds <= 0 || !Number.isFinite(moves) || moves < 0) {
      game.analytics.averageMovesPerRound = 0;
      return;
    }
    game.analytics.averageMovesPerRound = moves / rounds;
  }

  function updateFirstPlayerWinRate(game) {
    const decisiveRounds = game.analytics.decisiveRounds;
    const firstPlayerWins = game.analytics.firstPlayerWins;
    if (
      !Number.isFinite(decisiveRounds)
      || decisiveRounds <= 0
      || !Number.isFinite(firstPlayerWins)
      || firstPlayerWins < 0
    ) {
      game.analytics.firstPlayerWinRate = 0;
      return;
    }
    game.analytics.firstPlayerWinRate = firstPlayerWins / decisiveRounds;
  }

  function playHumanTurn(game, index) {
    if (game.isMatchOver || getWinner(game) !== null || isDraw(game)) {
      return false;
    }

    if (game.mode === 'pvp') {
      const mark = game.currentTurn === 'O' ? 'O' : 'X';
      const movedInPvp = applyMove(game, index, mark);
      if (!movedInPvp) {
        return false;
      }
      game.analytics.totalMoves += 1;

      if (getWinner(game) === null && !isDraw(game)) {
        game.currentTurn = mark === 'X' ? 'O' : 'X';
      } else {
        updatePvpMatchProgress(game);
      }
      return true;
    }

    const humanMark = getHumanMark(game);
    const computerMark = getComputerMark(game);
    game.currentTurn = 'X';
    const moved = applyMove(game, index, humanMark);
    if (!moved) {
      return false;
    }
    game.analytics.totalMoves += 1;

    if (getWinner(game) !== null || isDraw(game)) {
      updatePvcScoreboard(game);
      return true;
    }

    const boardForAi = getBoardForComputerPerspective(game.board, computerMark);
    const computerIndex = chooseComputerMove(boardForAi, {
      difficulty: game.difficulty,
    });
    if (computerIndex !== null) {
      applyMove(game, computerIndex, computerMark);
      game.analytics.totalMoves += 1;
    }
    updatePvcScoreboard(game);

    return true;
  }

  function getStatusMessage(game) {
    const playerName = getPlayerDisplayName(game);
    const playerTwoName = getPlayerTwoDisplayName(game);
    const isDefaultName = playerName === getDefaultPlayerNameForMode(game.mode);
    const humanMark = getHumanMark(game);
    const computerMark = getComputerMark(game);
    if (game.mode === 'pvp') {
      const winner = getWinner(game);
      if (winner === 'X') {
        return `${playerName} wins!`;
      }
      if (winner === 'O') {
        return `${playerTwoName} wins!`;
      }
      if (isDraw(game)) {
        return 'Draw.';
      }
      const activeMark = game.currentTurn === 'O' ? 'O' : 'X';
      const activeName = activeMark === 'X' ? playerName : playerTwoName;
      return `${activeName} (${activeMark}) turn!`;
    }

    if (game.isMatchOver) {
      if (game.matchWinner === humanMark) {
        return isDefaultName ? 'You win the match!' : `${playerName} wins the match!`;
      }
      if (game.matchWinner === computerMark) {
        return 'Computer wins the match!';
      }
      return 'Match is a draw.';
    }

    const winner = getWinner(game);
    if (winner === humanMark) {
      return isDefaultName ? 'You win!' : `${playerName} wins!`;
    }
    if (winner === computerMark) {
      return 'Computer wins!';
    }
    if (isDraw(game)) {
      return 'Draw.';
    }

    return isDefaultName ? 'Your turn!' : `${playerName}'s turn!`;
  }

  function initGame(doc, options = {}) {
    const statusEl = doc.getElementById('status');
    const boardEl = doc.getElementById('board');
    const playAgainEl = doc.getElementById('play-again');
    const newMatchEl = doc.getElementById('new-match');
    const resetStatsEl = doc.getElementById('reset-stats');
    const modeEl = doc.getElementById('mode');
    const playerNameEl = doc.getElementById('player-name');
    const playerNameLabelEl = doc.getElementById('player-name-label');
    const playerTwoNameEl = doc.getElementById('player-two-name');
    const playerTwoNameRowEl = doc.getElementById('player-two-name-row');
    const playerMarkRowEl = doc.getElementById('player-mark-row');
    const pvpTurnOrderNoteEl = doc.getElementById('pvp-turn-order-note');
    const playerMarkEl = doc.getElementById('player-mark');
    const difficultyRowEl = doc.getElementById('difficulty-row');
    const difficultyEl = doc.getElementById('difficulty');
    const matchLengthEl = doc.getElementById('match-length');
    const analyticsTotalRoundsEl = doc.getElementById('analytics-total-rounds');
    const analyticsTotalMovesEl = doc.getElementById('analytics-total-moves');
    const analyticsDrawsEl = doc.getElementById('analytics-draws');
    const analyticsAverageMovesEl = doc.getElementById('analytics-average-moves');
    const analyticsFirstWinRateEl = doc.getElementById('analytics-first-win-rate');
    const game = createGame();
    const shouldLoadPersistedState = options.loadPersistedState !== false;
    if (shouldLoadPersistedState) {
      loadPersistedState(game);
    }
    syncPlayerOneDefaultNameToMode(game);
    let isComputerThinking = false;
    let computerMoveTimeout = null;
    let confettiCleanupTimeout = null;
    let hasPlayedWinConfetti = false;
    let hasCountedCompletedRound = false;
    const settingButtonGroups = {};

    function getGroupButtons(groupEl) {
      if (!groupEl || typeof groupEl.querySelectorAll !== 'function') {
        return [];
      }
      return Array.from(groupEl.querySelectorAll('[data-setting-value]'));
    }

    function readDataAttribute(el, key) {
      if (!el) {
        return '';
      }
      if (el.dataset && typeof el.dataset[key] === 'string') {
        return el.dataset[key];
      }
      if (typeof el.getAttribute === 'function') {
        return el.getAttribute(`data-${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`) || '';
      }
      return '';
    }

    function getControlBySettingId(settingId) {
      if (settingId === 'mode') return modeEl;
      if (settingId === 'player-mark') return playerMarkEl;
      if (settingId === 'difficulty') return difficultyEl;
      if (settingId === 'match-length') return matchLengthEl;
      return null;
    }

    function syncSettingButtonGroup(settingId) {
      const groupEl = settingButtonGroups[settingId];
      const controlEl = getControlBySettingId(settingId);
      if (!groupEl || !controlEl) {
        return;
      }
      const controlValue = typeof controlEl.value === 'string' ? controlEl.value : '';
      const isDisabled = Boolean(controlEl.disabled);
      getGroupButtons(groupEl).forEach((buttonEl) => {
        const isActive = readDataAttribute(buttonEl, 'settingValue') === controlValue;
        setClassState(buttonEl, 'is-active', isActive);
        if (typeof buttonEl.setAttribute === 'function') {
          buttonEl.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        }
        buttonEl.disabled = isDisabled;
      });
    }

    function syncAllSettingButtonGroups() {
      Object.keys(settingButtonGroups).forEach(syncSettingButtonGroup);
    }

    function bindSettingButtonGroups() {
      if (!doc || typeof doc.querySelectorAll !== 'function') {
        return;
      }
      const groups = Array.from(doc.querySelectorAll('[data-setting-for]'));
      groups.forEach((groupEl) => {
        const settingId = readDataAttribute(groupEl, 'settingFor');
        const controlEl = getControlBySettingId(settingId);
        if (!settingId || !controlEl) {
          return;
        }
        settingButtonGroups[settingId] = groupEl;
        getGroupButtons(groupEl).forEach((buttonEl) => {
          if (!buttonEl || typeof buttonEl.addEventListener !== 'function') {
            return;
          }
          buttonEl.addEventListener('click', () => {
            if (controlEl.disabled) {
              return;
            }
            const nextValue = readDataAttribute(buttonEl, 'settingValue');
            if (!nextValue || controlEl.value === nextValue) {
              return;
            }
            controlEl.value = nextValue;
            if (typeof controlEl.dispatchEvent === 'function' && typeof Event === 'function') {
              controlEl.dispatchEvent(new Event('change', { bubbles: true }));
              return;
            }
            syncSettingButtonGroup(settingId);
          });
        });
      });
      syncAllSettingButtonGroups();
    }

    function clearWinConfetti() {
      if (!doc || typeof doc.getElementById !== 'function') {
        return;
      }

      const confettiLayer = doc.getElementById('confetti-layer');
      if (confettiLayer && typeof confettiLayer.innerHTML === 'string') {
        confettiLayer.innerHTML = '';
      }
      if (confettiCleanupTimeout !== null) {
        clearTimeout(confettiCleanupTimeout);
        confettiCleanupTimeout = null;
      }
    }

    function playWinConfetti() {
      if (
        !doc
        || typeof doc.getElementById !== 'function'
        || typeof doc.createElement !== 'function'
      ) {
        return;
      }

      const confettiLayer = doc.getElementById('confetti-layer');
      if (!confettiLayer || typeof confettiLayer.appendChild !== 'function') {
        return;
      }

      const colors = ['#ffb347', '#ef7f2e', '#f3d77c', '#89c8ff', '#f98d87'];
      confettiLayer.innerHTML = '';

      for (let i = 0; i < CONFETTI_PIECE_COUNT; i += 1) {
        const piece = doc.createElement('span');
        piece.className = 'confetti-piece';
        piece.style.setProperty('--piece-left', `${Math.random() * 100}%`);
        piece.style.setProperty('--piece-width', `${6 + Math.random() * 6}px`);
        piece.style.setProperty('--piece-height', `${8 + Math.random() * 10}px`);
        piece.style.setProperty('--fall-duration', `${CONFETTI_MIN_FALL_MS + Math.random() * CONFETTI_FALL_VARIANCE_MS}ms`);
        piece.style.setProperty('--piece-color', colors[Math.floor(Math.random() * colors.length)]);
        piece.style.setProperty('--piece-rotation', `${Math.random() * 140 - 70}deg`);
        confettiLayer.appendChild(piece);
      }

      if (confettiCleanupTimeout !== null) {
        clearTimeout(confettiCleanupTimeout);
      }
      confettiCleanupTimeout = setTimeout(() => {
        if (confettiLayer && typeof confettiLayer.innerHTML === 'string') {
          confettiLayer.innerHTML = '';
        }
        confettiCleanupTimeout = null;
      }, CONFETTI_CLEANUP_DELAY_MS);
    }

    function setClassState(el, className, isOn) {
      if (!el) {
        return;
      }

      if (el.classList && typeof el.classList.add === 'function' && typeof el.classList.remove === 'function') {
        if (isOn) {
          el.classList.add(className);
        } else {
          el.classList.remove(className);
        }
        return;
      }

      if (typeof el.className !== 'string') {
        return;
      }

      const classes = el.className.split(/\s+/).filter(Boolean);
      const hasClass = classes.includes(className);
      if (isOn && !hasClass) {
        classes.push(className);
      }
      if (!isOn && hasClass) {
        el.className = classes.filter((token) => token !== className).join(' ');
        return;
      }
      el.className = classes.join(' ');
    }

    function setThinkingState(isOn) {
      setClassState(statusEl, 'is-thinking', isOn);
      setClassState(boardEl, 'is-thinking', isOn);
      setClassState(playAgainEl, 'is-thinking', isOn);
    }

    function triggerTurnShiftCue() {
      setClassState(statusEl, 'is-turn-shift', false);
      setClassState(boardEl, 'is-turn-shift', false);
      setClassState(statusEl, 'is-turn-shift', true);
      setClassState(boardEl, 'is-turn-shift', true);
    }

    function setOutcomeState(resultClass) {
      const outcomeClasses = ['result-win', 'result-loss', 'result-draw'];
      outcomeClasses.forEach((className) => {
        const isActive = className === resultClass;
        setClassState(statusEl, className, isActive);
        setClassState(boardEl, className, isActive);
      });
    }

    function renderAnalytics() {
      if (analyticsTotalRoundsEl) {
        analyticsTotalRoundsEl.textContent = String(game.analytics.totalRounds);
      }
      if (analyticsTotalMovesEl) {
        analyticsTotalMovesEl.textContent = String(game.analytics.totalMoves);
      }
      if (analyticsDrawsEl) {
        analyticsDrawsEl.textContent = String(game.scoreboard.draws);
      }
      if (analyticsAverageMovesEl) {
        analyticsAverageMovesEl.textContent = game.analytics.averageMovesPerRound.toFixed(2);
      }
      if (analyticsFirstWinRateEl) {
        analyticsFirstWinRateEl.textContent = `${Math.round(game.analytics.firstPlayerWinRate * 100)}%`;
      }
    }

    function syncModeSpecificControls() {
      const isPvp = game.mode === 'pvp';
      const isPvc = !isPvp;
      if (playerNameLabelEl) {
        playerNameLabelEl.textContent = isPvp ? 'Player 1 name' : 'Player name';
      }
      if (playerTwoNameRowEl) {
        playerTwoNameRowEl.hidden = !isPvp;
        if (playerTwoNameRowEl.style && typeof playerTwoNameRowEl.style.display === 'string') {
          playerTwoNameRowEl.style.display = isPvp ? '' : 'none';
        }
      }
      if (playerTwoNameEl) {
        playerTwoNameEl.disabled = !isPvp;
      }
      if (playerMarkRowEl) {
        playerMarkRowEl.hidden = !isPvc;
        if (playerMarkRowEl.style && typeof playerMarkRowEl.style.display === 'string') {
          playerMarkRowEl.style.display = isPvc ? '' : 'none';
        }
      }
      if (playerMarkEl) {
        playerMarkEl.disabled = !isPvc;
      }
      syncSettingButtonGroup('player-mark');
      if (difficultyRowEl) {
        difficultyRowEl.hidden = !isPvc;
        if (difficultyRowEl.style && typeof difficultyRowEl.style.display === 'string') {
          difficultyRowEl.style.display = isPvc ? '' : 'none';
        }
      }
      if (difficultyEl) {
        difficultyEl.disabled = !isPvc;
      }
      syncSettingButtonGroup('difficulty');
      if (pvpTurnOrderNoteEl) {
        pvpTurnOrderNoteEl.hidden = !isPvp;
        if (pvpTurnOrderNoteEl.style && typeof pvpTurnOrderNoteEl.style.display === 'string') {
          pvpTurnOrderNoteEl.style.display = isPvp ? '' : 'none';
        }
      }
    }

    function render() {
      const winner = getWinner(game);
      const isRoundDraw = isDraw(game);
      const isRoundComplete = winner !== null || isRoundDraw;
      const shouldHighlightPlayAgain = isRoundComplete || game.isMatchOver;
      if (isRoundComplete && !hasCountedCompletedRound) {
        game.analytics.totalRounds += 1;
        if (winner !== null) {
          game.analytics.decisiveRounds += 1;
          if (winner === 'X') {
            game.analytics.firstPlayerWins += 1;
          }
        }
        hasCountedCompletedRound = true;
      } else if (!isRoundComplete) {
        hasCountedCompletedRound = false;
      }
      updateAverageMovesPerRound(game);
      updateFirstPlayerWinRate(game);

      persistGameState(game);
      boardEl.innerHTML = renderBoardHtml(game.board);
      setStatusText(statusEl, getStatusMessage(game));
      syncModeSpecificControls();
      syncAllSettingButtonGroups();
      renderAnalytics();
      if (!isComputerThinking) {
        setThinkingState(false);
      }
      if (playAgainEl) {
        if (game.isMatchOver) {
          playAgainEl.textContent = 'New Match';
        } else {
          playAgainEl.textContent = getCurrentGameLabel(game);
        }
        if (typeof playAgainEl.setAttribute === 'function') {
          playAgainEl.setAttribute('aria-label', playAgainEl.textContent);
        }
        setClassState(playAgainEl, 'is-ready', shouldHighlightPlayAgain);
      }

      const humanMark = getHumanMark(game);
      const computerMark = getComputerMark(game);
      if (game.mode === 'pvp' && winner !== null) {
        setOutcomeState('result-win');
        if (!hasPlayedWinConfetti) {
          playWinConfetti();
          hasPlayedWinConfetti = true;
        }
        return;
      }
      if (winner === humanMark) {
        setOutcomeState('result-win');
        if (!hasPlayedWinConfetti) {
          playWinConfetti();
          hasPlayedWinConfetti = true;
        }
        return;
      }
      if (winner === computerMark) {
        setOutcomeState('result-loss');
        hasPlayedWinConfetti = false;
        clearWinConfetti();
        return;
      }
      if (isRoundDraw) {
        setOutcomeState('result-draw');
        hasPlayedWinConfetti = false;
        clearWinConfetti();
        return;
      }
      setOutcomeState(null);
      hasPlayedWinConfetti = false;
      clearWinConfetti();
    }

    function resetRoundState() {
      if (computerMoveTimeout !== null) {
        clearTimeout(computerMoveTimeout);
        computerMoveTimeout = null;
      }
      clearWinConfetti();
      hasPlayedWinConfetti = false;
      isComputerThinking = false;
      hasCountedCompletedRound = false;
      setThinkingState(false);
      resetGame(game);
      render();
      maybeStartComputerOpeningTurn();
    }

    function chooseComputerMoveForGame() {
      const computerMark = getComputerMark(game);
      const boardForAi = getBoardForComputerPerspective(game.board, computerMark);

      return chooseComputerMove(boardForAi, {
        difficulty: game.difficulty,
      });
    }

    function maybeStartComputerOpeningTurn() {
      const shouldComputerOpen = game.mode === 'pvc'
        && getHumanMark(game) === 'O'
        && !game.isMatchOver
        && !isComputerThinking
        && getWinner(game) === null
        && !isDraw(game)
        && game.board.every((cell) => cell === null);

      if (!shouldComputerOpen) {
        return;
      }

      isComputerThinking = true;
      setThinkingState(true);
      boardEl.innerHTML = renderBoardHtml(game.board);
      setStatusText(statusEl, 'Computer thinking...');

      computerMoveTimeout = setTimeout(() => {
        const computerIndex = chooseComputerMoveForGame();
        if (computerIndex !== null) {
          applyMove(game, computerIndex, getComputerMark(game));
          game.analytics.totalMoves += 1;
        }
        updatePvcScoreboard(game);

        computerMoveTimeout = null;
        isComputerThinking = false;
        render();
      }, 1000);
    }

    if (modeEl && typeof modeEl.value === 'string') {
      modeEl.value = game.mode;
    }
    if (playerNameEl && typeof playerNameEl.value === 'string') {
      playerNameEl.value = game.playerName;
    }
    if (playerTwoNameEl && typeof playerTwoNameEl.value === 'string') {
      playerTwoNameEl.value = game.playerTwoName;
    }
    if (playerMarkEl && typeof playerMarkEl.value === 'string') {
      playerMarkEl.value = game.playerMark;
    }
    if (difficultyEl && typeof difficultyEl.value === 'string') {
      difficultyEl.value = game.difficulty;
    }
    if (matchLengthEl && typeof matchLengthEl.value === 'string') {
      matchLengthEl.value = game.matchLength;
    }
    bindSettingButtonGroups();

    let keyboardCursorIndex = 0;

    function isTextEntryTarget(target) {
      if (!target || typeof target !== 'object') {
        return false;
      }

      if (target.isContentEditable) {
        return true;
      }

      const tagName = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : '';
      return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    }

    function getKeyboardIndexFromEvent(event) {
      const eventIndex = getClickedIndex(event);
      if (Number.isInteger(eventIndex) && eventIndex >= 0 && eventIndex <= 8) {
        keyboardCursorIndex = eventIndex;
        return eventIndex;
      }

      if (!Number.isInteger(keyboardCursorIndex) || keyboardCursorIndex < 0 || keyboardCursorIndex > 8) {
        keyboardCursorIndex = 0;
      }

      return keyboardCursorIndex;
    }

    function getNextBoardIndex(index, key) {
      const row = Math.floor(index / 3);
      const col = index % 3;
      let nextIndex = index;
      if (key === 'ArrowLeft' && col > 0) {
        nextIndex = index - 1;
      } else if (key === 'ArrowRight' && col < 2) {
        nextIndex = index + 1;
      } else if (key === 'ArrowUp' && row > 0) {
        nextIndex = index - 3;
      } else if (key === 'ArrowDown' && row < 2) {
        nextIndex = index + 3;
      }
      return nextIndex;
    }

    function focusBoardCell(index) {
      if (typeof boardEl.querySelector !== 'function') {
        return;
      }
      const nextCell = boardEl.querySelector(`.cell[data-index="${index}"]`);
      if (nextCell && typeof nextCell.focus === 'function') {
        nextCell.focus();
      }
    }

    function handleBoardKeyboardInput(event) {
      if (!event) {
        return;
      }

      const isActivationKey = event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
      const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);
      if (!isActivationKey && !isArrowKey) {
        return;
      }

      const index = getKeyboardIndexFromEvent(event);
      if (isActivationKey) {
        event.preventDefault();
        handleCellSelection(index);
        return;
      }

      event.preventDefault();
      keyboardCursorIndex = getNextBoardIndex(index, event.key);
      focusBoardCell(keyboardCursorIndex);
    }

    if (typeof boardEl.setAttribute === 'function') {
      boardEl.setAttribute('tabindex', '0');
      boardEl.setAttribute('role', 'grid');
      boardEl.setAttribute('aria-label', 'Tic-tac-toe board');
    }

    boardEl.addEventListener('click', (event) => {
      if (isComputerThinking) {
        return;
      }

      const index = getClickedIndex(event);
      if (index === null) {
        return;
      }

      handleCellSelection(index);
    });

    function handleCellSelection(index) {
      if (getWinner(game) !== null || isDraw(game)) {
        return;
      }

      if (game.isMatchOver) {
        return;
      }

      if (game.mode === 'pvp') {
        const movedInPvp = playHumanTurn(game, index);
        if (!movedInPvp) {
          setStatusText(statusEl, 'Invalid move.');
          return;
        }
        triggerTurnShiftCue();
        render();
        return;
      }

      const moved = applyMove(game, index, getHumanMark(game));
      if (!moved) {
        setStatusText(statusEl, 'Invalid move.');
        return;
      }
      game.analytics.totalMoves += 1;
      triggerTurnShiftCue();

      if (getWinner(game) !== null || isDraw(game)) {
        updatePvcScoreboard(game);
        render();
        return;
      }

      isComputerThinking = true;
      setThinkingState(true);
      boardEl.innerHTML = renderBoardHtml(game.board);
      setStatusText(statusEl, 'Computer thinking...');

      computerMoveTimeout = setTimeout(() => {
        const computerIndex = chooseComputerMoveForGame();
        if (computerIndex !== null) {
          applyMove(game, computerIndex, getComputerMark(game));
          game.analytics.totalMoves += 1;
        }
        updatePvcScoreboard(game);
        triggerTurnShiftCue();

        computerMoveTimeout = null;
        isComputerThinking = false;
        render();
      }, 1000);
    }

    boardEl.addEventListener('keydown', handleBoardKeyboardInput);

    if (doc && typeof doc.addEventListener === 'function') {
      doc.addEventListener('keydown', (event) => {
        if (!event || event.defaultPrevented) {
          return;
        }
        if (isTextEntryTarget(event.target)) {
          return;
        }
        if (event.target === playAgainEl || event.target === newMatchEl || event.target === resetStatsEl) {
          return;
        }
        handleBoardKeyboardInput(event);
      });
    }

    boardEl.addEventListener('focus', (event) => {
      if (!event || event.target !== boardEl) {
        return;
      }
      focusBoardCell(keyboardCursorIndex);
    });

    function startNewMatch() {
      resetScoreboard(game);
      resetAnalytics(game);
      resetMatchState(game);
      resetRoundState();
    }

    playAgainEl.addEventListener('click', () => {
      if (game.isMatchOver) {
        startNewMatch();
        return;
      }
      resetRoundState();
    });

    if (resetStatsEl && typeof resetStatsEl.addEventListener === 'function') {
      resetStatsEl.addEventListener('click', () => {
        resetScoreboard(game);
        resetAnalytics(game);
        render();
      });
    }

    if (newMatchEl && typeof newMatchEl.addEventListener === 'function') {
      newMatchEl.addEventListener('click', startNewMatch);
    }

    if (modeEl && typeof modeEl.addEventListener === 'function') {
      modeEl.addEventListener('change', () => {
        const previousMode = game.mode;
        game.mode = modeEl.value === 'pvp' ? 'pvp' : 'pvc';
        const previousDefaultName = getDefaultPlayerNameForMode(previousMode);
        const nextDefaultName = getDefaultPlayerNameForMode(game.mode);
        const normalizedPlayerName = normalizeName(game.playerName, previousDefaultName);
        const normalizedInputName = playerNameEl && typeof playerNameEl.value === 'string'
          ? normalizeName(playerNameEl.value, previousDefaultName)
          : normalizedPlayerName;
        if (normalizedPlayerName === previousDefaultName || normalizedInputName === previousDefaultName) {
          game.playerName = nextDefaultName;
          if (playerNameEl && typeof playerNameEl.value === 'string') {
            playerNameEl.value = game.playerName;
          }
        }
        if (game.mode !== previousMode) {
          resetMatchState(game);
        }
        resetRoundState();
      });
    }

    if (playerNameEl && typeof playerNameEl.addEventListener === 'function') {
      playerNameEl.addEventListener('change', () => {
        game.playerName = normalizeName(playerNameEl.value, getDefaultPlayerNameForMode(game.mode));
        playerNameEl.value = game.playerName;
        render();
      });
    }

    if (playerTwoNameEl && typeof playerTwoNameEl.addEventListener === 'function') {
      playerTwoNameEl.addEventListener('change', () => {
        game.playerTwoName = normalizeName(playerTwoNameEl.value, 'Player 2');
        playerTwoNameEl.value = game.playerTwoName;
        render();
      });
    }

    if (playerMarkEl && typeof playerMarkEl.addEventListener === 'function') {
      playerMarkEl.addEventListener('change', () => {
        game.playerMark = playerMarkEl.value === 'O' ? 'O' : 'X';
        playerMarkEl.value = game.playerMark;
        resetRoundState();
      });
    }

    if (difficultyEl && typeof difficultyEl.addEventListener === 'function') {
      difficultyEl.addEventListener('change', () => {
        game.difficulty = DIFFICULTIES.includes(difficultyEl.value) ? difficultyEl.value : 'medium';
        difficultyEl.value = game.difficulty;
        resetRoundState();
      });
    }

    if (matchLengthEl && typeof matchLengthEl.addEventListener === 'function') {
      matchLengthEl.addEventListener('change', () => {
        game.matchLength = MATCH_LENGTHS.includes(matchLengthEl.value) ? matchLengthEl.value : 'single';
        matchLengthEl.value = game.matchLength;
        resetMatchState(game);
        resetRoundState();
      });
    }

    render();
    maybeStartComputerOpeningTurn();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => initGame(document, { loadPersistedState: false }));
    } else {
      initGame(document, { loadPersistedState: false });
    }
  }

  return {
    initGame,
    playHumanTurn,
  };
}));
