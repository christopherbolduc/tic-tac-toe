const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { createGame, applyMove, getWinner, isDraw, resetGame } = require('./game');
const { chooseComputerMove } = require('./ai');
const { renderBoardHtml, setStatusText, getClickedIndex } = require('./ui');
const { playHumanTurn, initGame } = require('./main');

function createElement(initial = {}) {
  return {
    innerHTML: initial.innerHTML || '',
    textContent: initial.textContent || '',
    value: initial.value || '',
    checked: Boolean(initial.checked),
    className: initial.className || '',
    hidden: initial.hidden !== undefined ? initial.hidden : false,
    disabled: Boolean(initial.disabled),
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    dispatch(type, event = {}) {
      this.listeners[type](event);
    },
  };
}

test('createGame initializes an empty 3x3 board', () => {
  const game = createGame();

  assert.deepEqual(game.board, [
    null, null, null,
    null, null, null,
    null, null, null
  ]);
  assert.equal(game.mode, 'pvc');
  assert.equal(game.difficulty, 'medium');
  assert.equal(game.matchLength, 'single');
  assert.deepEqual(game.scoreboard, {
    playerWins: 0,
    computerWins: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
  });
});

test('applyMove places a mark on an empty cell', () => {
  const game = createGame();

  const moved = applyMove(game, 0, 'X');

  assert.equal(moved, true);
  assert.equal(game.board[0], 'X');
});

test('winner and draw checks evaluate board state', () => {
  const winnerGame = createGame();
  winnerGame.board = [
    'X', 'X', 'X',
    null, 'O', null,
    'O', null, null
  ];

  const drawGame = createGame();
  drawGame.board = [
    'X', 'O', 'X',
    'X', 'O', 'O',
    'O', 'X', 'X'
  ];

  assert.equal(getWinner(winnerGame), 'X');
  assert.equal(isDraw(drawGame), true);
});

test('resetGame clears the board back to empty', () => {
  const game = createGame();
  applyMove(game, 0, 'X');
  applyMove(game, 4, 'O');

  resetGame(game);

  assert.deepEqual(game.board, [
    null, null, null,
    null, null, null,
    null, null, null
  ]);
});

test('resetGame preserves match-over metadata while clearing board state', () => {
  const game = createGame();
  game.isMatchOver = true;
  game.matchWinner = 'X';
  applyMove(game, 0, 'X');

  resetGame(game);

  assert.equal(game.isMatchOver, true);
  assert.equal(game.matchWinner, 'X');
  assert.deepEqual(game.board, [
    null, null, null,
    null, null, null,
    null, null, null,
  ]);
});

test('chooseComputerMove follows heuristic priority', () => {
  const winBoard = [
    'O', 'O', null,
    'X', 'X', null,
    null, null, null
  ];
  assert.equal(chooseComputerMove(winBoard), 2);

  const blockBoard = [
    'X', 'X', null,
    'O', null, null,
    null, null, null
  ];
  assert.equal(chooseComputerMove(blockBoard), 2);

  const centerBoard = [
    'X', null, null,
    null, null, null,
    null, null, null
  ];
  assert.equal(chooseComputerMove(centerBoard), 4);

  const cornerBoard = [
    'X', null, 'O',
    null, 'X', null,
    'O', null, null
  ];
  assert.equal(chooseComputerMove(cornerBoard), 8);

  const edgeBoard = [
    'X', 'O', 'X',
    null, 'O', 'X',
    'O', 'X', 'O'
  ];
  assert.equal(chooseComputerMove(edgeBoard), 3);
});

test('chooseComputerMove uses random legal move on easy difficulty', () => {
  const board = [
    'X', null, 'O',
    null, 'X', null,
    'O', null, null
  ];

  const move = chooseComputerMove(board, {
    difficulty: 'easy',
    randomFn: () => 0.6,
  });

  assert.equal(move, 7);
});

test('chooseComputerMove uses heuristic behavior on medium difficulty', () => {
  const board = [
    'X', null, null,
    null, null, null,
    null, null, null
  ];

  const move = chooseComputerMove(board, {
    difficulty: 'medium',
    mistakeChance: 1,
    randomFn: () => 0,
  });

  assert.equal(move, 4);
});

test('chooseComputerMove uses minimax on hard difficulty', () => {
  const board = [
    null, null, null,
    null, 'O', 'X',
    null, 'X', null
  ];

  const move = chooseComputerMove(board, {
    difficulty: 'hard',
  });

  assert.equal(move, 2);
});

test('difficulty only affects pvc mode and is ignored in pvp', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  const pvcGame = createGame();
  pvcGame.mode = 'pvc';
  pvcGame.difficulty = 'easy';
  const pvcMoved = playHumanTurn(pvcGame, 0);

  const pvpGame = createGame();
  pvpGame.mode = 'pvp';
  pvpGame.difficulty = 'easy';
  const pvpFirst = playHumanTurn(pvpGame, 0);
  const pvpSecond = playHumanTurn(pvpGame, 1);

  Math.random = originalRandom;

  assert.equal(pvcMoved, true);
  assert.equal(pvcGame.board[0], 'X');
  assert.equal(pvcGame.board[1], 'O');
  assert.equal(pvpFirst, true);
  assert.equal(pvpSecond, true);
  assert.equal(pvpGame.board[0], 'X');
  assert.equal(pvpGame.board[1], 'O');
  assert.equal(pvpGame.board[4], null);
});

test('renderBoardHtml builds a 3x3 button grid with board marks', () => {
  const board = [
    'X', null, 'O',
    null, 'X', null,
    'O', null, null
  ];

  const html = renderBoardHtml(board);

  assert.equal((html.match(/data-index=\"\d\"/g) || []).length, 9);
  assert.match(html, /data-index=\"0\">X<\/button>/);
  assert.match(html, /data-index=\"2\">O<\/button>/);
  assert.match(html, /data-index=\"1\"><\/button>/);
});

test('playHumanTurn orchestrates a human move then computer move', () => {
  const game = createGame();

  const moved = playHumanTurn(game, 0);

  assert.equal(moved, true);
  assert.equal(game.board[0], 'X');
  assert.equal(game.board[4], 'O');
});

test('playHumanTurn ignores input when game is already over', () => {
  const game = createGame();
  game.board = [
    'X', 'X', 'X',
    null, 'O', null,
    null, null, 'O'
  ];

  const moved = playHumanTurn(game, 3);

  assert.equal(moved, false);
  assert.equal(game.board[3], null);
});

test('playHumanTurn alternates X and O in pvp mode without AI moves', () => {
  const game = createGame();
  game.mode = 'pvp';

  const firstMove = playHumanTurn(game, 0);
  const secondMove = playHumanTurn(game, 1);

  assert.equal(firstMove, true);
  assert.equal(secondMove, true);
  assert.equal(game.board[0], 'X');
  assert.equal(game.board[1], 'O');
  assert.equal(game.board[4], null);
});

test('playHumanTurn keeps pvc behavior as human X plus computer O', () => {
  const game = createGame();
  game.mode = 'pvc';
  game.currentTurn = 'O';

  const moved = playHumanTurn(game, 0);

  assert.equal(moved, true);
  assert.equal(game.board[0], 'X');
  assert.equal(game.board[4], 'O');
  assert.equal(game.currentTurn, 'X');
});

test('playHumanTurn updates pvc scoreboard on player win, computer win, and draw', () => {
  const game = createGame();
  game.mode = 'pvc';
  game.matchLength = 'bo3';

  game.board = [
    'X', 'X', null,
    null, 'O', null,
    null, null, null
  ];
  assert.equal(playHumanTurn(game, 2), true);
  assert.equal(game.scoreboard.playerWins, 1);
  assert.equal(game.scoreboard.computerWins, 0);
  assert.equal(game.scoreboard.draws, 0);

  resetGame(game);
  game.board = [
    'O', 'O', null,
    'X', null, 'X',
    null, null, null
  ];
  assert.equal(playHumanTurn(game, 6), true);
  assert.equal(game.scoreboard.playerWins, 1);
  assert.equal(game.scoreboard.computerWins, 1);
  assert.equal(game.scoreboard.draws, 0);

  resetGame(game);
  game.board = [
    'X', 'O', 'X',
    'X', 'O', 'O',
    'O', 'X', null
  ];
  assert.equal(playHumanTurn(game, 8), true);
  assert.equal(game.scoreboard.playerWins, 1);
  assert.equal(game.scoreboard.computerWins, 1);
  assert.equal(game.scoreboard.draws, 1);
});

test('playHumanTurn tracks streak on pvc wins and resets on loss/draw', () => {
  const game = createGame();
  game.mode = 'pvc';
  game.matchLength = 'bo3';

  game.board = [
    'X', 'X', null,
    null, 'O', null,
    null, null, null
  ];
  assert.equal(playHumanTurn(game, 2), true);
  assert.equal(game.scoreboard.currentStreak, 1);
  assert.equal(game.scoreboard.bestStreak, 1);

  resetGame(game);
  game.board = [
    'X', 'X', null,
    null, 'O', null,
    null, null, null
  ];
  assert.equal(playHumanTurn(game, 2), true);
  assert.equal(game.scoreboard.currentStreak, 2);
  assert.equal(game.scoreboard.bestStreak, 2);

  resetGame(game);
  game.board = [
    'O', 'O', null,
    'X', null, 'X',
    null, null, null
  ];
  assert.equal(playHumanTurn(game, 6), true);
  assert.equal(game.scoreboard.currentStreak, 0);
  assert.equal(game.scoreboard.bestStreak, 2);

  game.matchGamesPlayed = 0;
  game.matchScore.playerWins = 0;
  game.matchScore.computerWins = 0;
  game.isMatchOver = false;
  game.matchWinner = null;

  resetGame(game);
  game.board = [
    'X', 'O', 'X',
    'X', 'O', 'O',
    'O', 'X', null
  ];
  assert.equal(playHumanTurn(game, 8), true);
  assert.equal(game.scoreboard.currentStreak, 0);
  assert.equal(game.scoreboard.bestStreak, 2);
});

test('playHumanTurn tracks match round wins separately from lifetime stats', () => {
  const game = createGame();
  game.mode = 'pvc';
  game.matchLength = 'bo3';

  game.board = [
    'X', 'X', null,
    null, 'O', null,
    null, null, null
  ];
  assert.equal(playHumanTurn(game, 2), true);
  assert.equal(game.scoreboard.playerWins, 1);
  assert.equal(game.matchScore.playerWins, 1);

  resetGame(game);
  game.board = [
    'O', 'O', null,
    'X', null, 'X',
    null, null, null
  ];
  assert.equal(playHumanTurn(game, 6), true);
  assert.equal(game.scoreboard.computerWins, 1);
  assert.equal(game.matchScore.computerWins, 1);
});

test('playHumanTurn marks match as over when configured game count is reached', () => {
  const game = createGame();
  game.mode = 'pvc';
  game.matchLength = 'bo3';
  game.matchScore.playerWins = 1;
  game.matchGamesPlayed = 2;

  game.board = [
    'X', 'X', null,
    null, 'O', null,
    null, null, null
  ];
  assert.equal(playHumanTurn(game, 2), true);

  assert.equal(game.matchScore.playerWins, 2);
  assert.equal(game.matchGamesPlayed, 3);
  assert.equal(game.isMatchOver, true);
});

test('bo3 does not end early after two completed games even if same side wins both', () => {
  const game = createGame();
  game.mode = 'pvc';
  game.matchLength = 'bo3';

  game.board = [
    'X', 'X', null,
    null, 'O', null,
    null, null, null,
  ];
  assert.equal(playHumanTurn(game, 2), true);
  assert.equal(game.matchGamesPlayed, 1);
  assert.equal(game.matchScore.playerWins, 1);
  assert.equal(game.isMatchOver, false);

  resetGame(game);
  game.board = [
    'X', 'X', null,
    null, 'O', null,
    null, null, null,
  ];
  assert.equal(playHumanTurn(game, 2), true);
  assert.equal(game.matchGamesPlayed, 2);
  assert.equal(game.matchScore.playerWins, 2);
  assert.equal(game.isMatchOver, false);
});

test('playHumanTurn sets match winner and blocks input after match is over', () => {
  const game = createGame();
  game.mode = 'pvc';
  game.matchLength = 'single';
  game.board = [
    'X', 'X', null,
    null, 'O', null,
    null, null, null
  ];

  assert.equal(playHumanTurn(game, 2), true);
  assert.equal(game.isMatchOver, true);
  assert.equal(game.matchWinner, 'X');
  assert.equal(playHumanTurn(game, 3), false);
});

test('index.html includes minimal gameplay DOM structure', () => {
  const html = fs.readFileSync('./index.html', 'utf8');

  assert.match(html, /<h1[^>]*>Tic-Tac-Toe<\/h1>/);
  assert.match(html, /id=\"status\"/);
  assert.match(html, /id=\"board\"/);
  assert.match(html, /id=\"play-again\"/);
});

test('index.html defines a dark glassmorphism style foundation', () => {
  const html = fs.readFileSync('./index.html', 'utf8');

  assert.match(html, /:root\s*\{/);
  assert.match(html, /--color-bg:/);
  assert.match(html, /--color-accent:/);
  assert.match(html, /--blur-panel:/);
  assert.match(html, /--glow-soft:/);
  assert.match(html, /font-family:/);
  assert.match(html, /line-height:/);
  assert.match(html, /color:\s*var\(--color-text\)/);
});

test('index.html includes polished panel layout and responsive structure', () => {
  const html = fs.readFileSync('./index.html', 'utf8');

  assert.match(html, /class=\"app-shell\"/);
  assert.match(html, /class=\"game-panel\"/);
  assert.match(html, /class=\"bg-orb orb-a\"/);
  assert.match(html, /class=\"bg-orb orb-b\"/);
  assert.match(html, /class=\"panel-actions\"/);
  assert.match(html, /@media\s*\(max-width:\s*640px\)/);
});

test('interactive state styles and turn-feedback hooks are defined', () => {
  const html = fs.readFileSync('./index.html', 'utf8');
  const mainSource = fs.readFileSync('./main.js', 'utf8');

  assert.match(html, /\.cell:hover/);
  assert.match(html, /\.cell:focus-visible/);
  assert.match(html, /\.cell\s*\{[\s\S]*transition:/);
  assert.match(html, /#status\.is-thinking/);
  assert.match(html, /#board\.is-thinking\s+\.cell/);
  assert.match(html, /@keyframes\s+statusPulse/);
  assert.match(mainSource, /is-thinking/);
});

test('outcome effect styles and result-state hooks are defined', () => {
  const html = fs.readFileSync('./index.html', 'utf8');
  const mainSource = fs.readFileSync('./main.js', 'utf8');

  assert.match(html, /#status\.result-win/);
  assert.match(html, /#status\.result-loss/);
  assert.match(html, /#status\.result-draw/);
  assert.match(html, /#board\.result-win\s+\.cell/);
  assert.match(html, /#board\.result-loss\s+\.cell/);
  assert.match(html, /#board\.result-draw\s+\.cell/);
  assert.match(html, /@keyframes\s+outcomePulseWin/);
  assert.match(html, /@keyframes\s+outcomePulseLoss/);
  assert.match(html, /@keyframes\s+outcomePulseDraw/);
  assert.match(mainSource, /result-win/);
  assert.match(mainSource, /result-loss/);
  assert.match(mainSource, /result-draw/);
});

test('initGame wires board clicks and play-again reset flow', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
      }[id];
    },
  };

  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const pendingTimeouts = new Map();
  let nextTimeoutId = 1;

  global.setTimeout = (callback) => {
    const id = nextTimeoutId;
    nextTimeoutId += 1;
    pendingTimeouts.set(id, callback);
    return id;
  };
  global.clearTimeout = (id) => {
    pendingTimeouts.delete(id);
  };

  initGame(doc);

  assert.equal((boardEl.innerHTML.match(/class=\"cell\"/g) || []).length, 9);
  assert.equal(statusEl.textContent, 'Your turn!');

  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  assert.match(boardEl.innerHTML, /data-index=\"0\">X<\/button>/);
  assert.equal(statusEl.textContent, 'Computer thinking...');

  pendingTimeouts.get(1)();
  assert.equal((boardEl.innerHTML.match(/>O<\/button>/g) || []).length, 1);
  assert.equal(statusEl.textContent, 'Your turn!');

  playAgainEl.dispatch('click');
  assert.match(boardEl.innerHTML, /data-index=\"0\"><\/button>/);
  assert.equal(statusEl.textContent, 'Your turn!');

  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
});

test('ui helpers set status text and read clicked cell index', () => {
  const statusEl = { textContent: '' };
  setStatusText(statusEl, 'Computer wins!');
  assert.equal(statusEl.textContent, 'Computer wins!');

  const clickEvent = { target: { dataset: { index: '7' } } };
  assert.equal(getClickedIndex(clickEvent), 7);

  const badEvent = { target: {} };
  assert.equal(getClickedIndex(badEvent), null);
});

test('initGame shows invalid move message for occupied cell click', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
      }[id];
    },
  };

  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const pendingTimeouts = new Map();
  let nextTimeoutId = 1;

  global.setTimeout = (callback) => {
    const id = nextTimeoutId;
    nextTimeoutId += 1;
    pendingTimeouts.set(id, callback);
    return id;
  };
  global.clearTimeout = (id) => {
    pendingTimeouts.delete(id);
  };

  initGame(doc);
  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  pendingTimeouts.get(1)();
  const boardAfterFirstMove = boardEl.innerHTML;

  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });

  assert.equal(boardEl.innerHTML, boardAfterFirstMove);
  assert.equal(statusEl.textContent, 'Invalid move.');

  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
});

test('initGame wires mode switch to reset board and apply pvp turns', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const modeEl = createElement({ value: 'pvc' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        mode: modeEl,
      }[id];
    },
  };

  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const pendingTimeouts = new Map();
  let nextTimeoutId = 1;

  global.setTimeout = (callback) => {
    const id = nextTimeoutId;
    nextTimeoutId += 1;
    pendingTimeouts.set(id, callback);
    return id;
  };
  global.clearTimeout = (id) => {
    pendingTimeouts.delete(id);
  };

  initGame(doc);
  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  assert.match(boardEl.innerHTML, /data-index=\"0\">X<\/button>/);
  assert.equal(statusEl.textContent, 'Computer thinking...');
  assert.equal(pendingTimeouts.size, 1);

  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  assert.match(boardEl.innerHTML, /data-index=\"0\"><\/button>/);
  assert.equal(statusEl.textContent, 'Player 1 (X) turn!');
  assert.equal(pendingTimeouts.size, 0);

  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '1' } } });
  assert.match(boardEl.innerHTML, /data-index=\"0\">X<\/button>/);
  assert.match(boardEl.innerHTML, /data-index=\"1\">O<\/button>/);

  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
});

test('mode switch resets match progress so pvp starts a fresh match flow', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const matchLengthEl = createElement({ value: 'bo3' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        mode: modeEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  let persistedState = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      if (key !== 'ttt-state') {
        return null;
      }
      return JSON.stringify({
        mode: 'pvc',
        matchLength: 'bo3',
        matchScore: { playerWins: 1, computerWins: 0 },
        matchGamesPlayed: 1,
        isMatchOver: false,
      });
    },
    setItem(_key, value) {
      persistedState = JSON.parse(value);
    },
  };

  initGame(doc);
  assert.equal(playAgainEl.textContent, 'Game Two');

  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });

  assert.equal(playAgainEl.textContent, 'Game One');
  assert.deepEqual(persistedState.matchScore, { playerWins: 0, computerWins: 0 });
  assert.equal(persistedState.matchGamesPlayed, 0);
  assert.equal(persistedState.isMatchOver, false);

  global.localStorage = originalLocalStorage;
});

test('initGame persists scoreboard and selected settings to localStorage', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const modeEl = createElement({ value: 'pvc' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        mode: modeEl,
      }[id];
    },
  };

  let persistedKey = null;
  let persistedValue = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    setItem(key, value) {
      persistedKey = key;
      persistedValue = value;
    },
  };

  initGame(doc);

  assert.equal(persistedKey, 'ttt-state');
  const parsed = JSON.parse(persistedValue);
  assert.equal(parsed.mode, 'pvc');
  assert.equal(parsed.difficulty, 'medium');
  assert.deepEqual(parsed.scoreboard, {
    playerWins: 0,
    computerWins: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
  });

  global.localStorage = originalLocalStorage;
});

test('initGame loads persisted scoreboard and settings with safe defaults', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const modeEl = createElement({ value: 'pvc' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        mode: modeEl,
      }[id];
    },
  };

  const savedState = {
    mode: 'pvp',
    difficulty: 'easy',
    scoreboard: {
      playerWins: 3,
      computerWins: 2,
      draws: 1,
      currentStreak: 2,
      bestStreak: 4,
    },
  };

  let persistedValue = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      return key === 'ttt-state' ? JSON.stringify(savedState) : null;
    },
    setItem(_key, value) {
      persistedValue = value;
    },
  };

  initGame(doc);

  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '1' } } });
  assert.match(boardEl.innerHTML, /data-index=\"0\">X<\/button>/);
  assert.match(boardEl.innerHTML, /data-index=\"1\">O<\/button>/);

  const parsed = JSON.parse(persistedValue);
  assert.equal(parsed.mode, 'pvp');
  assert.equal(parsed.difficulty, 'easy');
  assert.deepEqual(parsed.scoreboard, savedState.scoreboard);

  global.localStorage = originalLocalStorage;
});

test('initGame reset-stats action clears in-memory and persisted scoreboard stats', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const resetStatsEl = createElement();

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        mode: modeEl,
        'reset-stats': resetStatsEl,
      }[id];
    },
  };

  const savedState = {
    mode: 'pvc',
    difficulty: 'medium',
    scoreboard: {
      playerWins: 7,
      computerWins: 4,
      draws: 2,
      currentStreak: 3,
      bestStreak: 5,
    },
  };

  let persistedValue = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      return key === 'ttt-state' ? JSON.stringify(savedState) : null;
    },
    setItem(_key, value) {
      persistedValue = value;
    },
  };

  initGame(doc);
  resetStatsEl.dispatch('click');

  const parsed = JSON.parse(persistedValue);
  assert.deepEqual(parsed.scoreboard, {
    playerWins: 0,
    computerWins: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
  });

  global.localStorage = originalLocalStorage;
});

test('initGame reset-stats action also clears persisted analytics counters', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const resetStatsEl = createElement();

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        mode: modeEl,
        'reset-stats': resetStatsEl,
      }[id];
    },
  };

  const savedState = {
    mode: 'pvc',
    analytics: {
      totalRounds: 4,
      totalMoves: 22,
      averageMovesPerRound: 5.5,
      firstPlayerWins: 3,
      decisiveRounds: 4,
      firstPlayerWinRate: 0.75,
    },
  };

  let persistedValue = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      return key === 'ttt-state' ? JSON.stringify(savedState) : null;
    },
    setItem(_key, value) {
      persistedValue = value;
    },
  };

  initGame(doc);
  resetStatsEl.dispatch('click');

  const parsed = JSON.parse(persistedValue);
  assert.deepEqual(parsed.analytics, {
    totalRounds: 0,
    totalMoves: 0,
    averageMovesPerRound: 0,
    firstPlayerWins: 0,
    decisiveRounds: 0,
    firstPlayerWinRate: 0,
  });

  global.localStorage = originalLocalStorage;
});

test('initGame new-match action resets match state and lifetime stats', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const resetStatsEl = createElement();
  const newMatchEl = createElement();
  const modeEl = createElement({ value: 'pvc' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'reset-stats': resetStatsEl,
        'new-match': newMatchEl,
        mode: modeEl,
      }[id];
    },
  };

  const savedState = {
    mode: 'pvc',
    difficulty: 'medium',
    matchLength: 'bo3',
    scoreboard: {
      playerWins: 5,
      computerWins: 3,
      draws: 1,
      currentStreak: 2,
      bestStreak: 4,
    },
    matchScore: {
      playerWins: 2,
      computerWins: 1,
    },
    matchGamesPlayed: 3,
    isMatchOver: true,
    matchWinner: 'X',
  };

  let persistedValue = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      return key === 'ttt-state' ? JSON.stringify(savedState) : null;
    },
    setItem(_key, value) {
      persistedValue = value;
    },
  };

  initGame(doc);
  newMatchEl.dispatch('click');

  const parsed = JSON.parse(persistedValue);
  assert.deepEqual(parsed.scoreboard, {
    playerWins: 0,
    computerWins: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
  });
  assert.deepEqual(parsed.analytics, {
    totalRounds: 0,
    totalMoves: 0,
    averageMovesPerRound: 0,
    firstPlayerWins: 0,
    decisiveRounds: 0,
    firstPlayerWinRate: 0,
  });
  assert.deepEqual(parsed.matchScore, { playerWins: 0, computerWins: 0 });
  assert.equal(parsed.isMatchOver, false);
  assert.equal(parsed.matchWinner, null);

  global.localStorage = originalLocalStorage;
});

test('initGame applies player name trim with default fallback', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
      }[id];
    },
  };

  let persistedValue = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem(_key, value) {
      persistedValue = value;
    },
  };

  initGame(doc);
  playerNameEl.value = '   ';
  playerNameEl.dispatch('change', { target: playerNameEl });

  const parsed = JSON.parse(persistedValue);
  assert.equal(parsed.playerName, 'Player');

  global.localStorage = originalLocalStorage;
});

test('initGame updates player marker choice in pvc settings', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerMarkEl = createElement({ value: 'X' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-mark': playerMarkEl,
      }[id];
    },
  };

  let persistedValue = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem(_key, value) {
      persistedValue = value;
    },
  };

  initGame(doc);
  playerMarkEl.value = 'O';
  playerMarkEl.dispatch('change', { target: playerMarkEl });

  const parsed = JSON.parse(persistedValue);
  assert.equal(parsed.playerMark, 'O');

  global.localStorage = originalLocalStorage;
});

test('initGame lets computer open as X when player marker is O', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerMarkEl = createElement({ value: 'X' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-mark': playerMarkEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      if (key !== 'ttt-state') {
        return null;
      }
      return JSON.stringify({ mode: 'pvc', playerMark: 'O' });
    },
    setItem() {},
  };

  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const pendingTimeouts = new Map();
  let nextTimeoutId = 1;

  global.setTimeout = (callback) => {
    const id = nextTimeoutId;
    nextTimeoutId += 1;
    pendingTimeouts.set(id, callback);
    return id;
  };
  global.clearTimeout = (id) => {
    pendingTimeouts.delete(id);
  };

  initGame(doc);
  assert.equal(statusEl.textContent, 'Computer thinking...');
  assert.equal(pendingTimeouts.size, 1);

  pendingTimeouts.get(1)();
  assert.equal((boardEl.innerHTML.match(/>X<\/button>/g) || []).length, 1);
  assert.equal(statusEl.textContent, 'Your turn!');

  global.localStorage = originalLocalStorage;
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
});

test('initGame restores persisted player name and marker preferences', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: '' });
  const playerMarkEl = createElement({ value: 'X' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-mark': playerMarkEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      if (key !== 'ttt-state') {
        return null;
      }
      return JSON.stringify({
        mode: 'pvc',
        playerName: 'Casey',
        playerMark: 'O',
      });
    },
    setItem() {},
  };

  initGame(doc);

  assert.equal(playerNameEl.value, 'Casey');
  assert.equal(playerMarkEl.value, 'O');

  global.localStorage = originalLocalStorage;
});

test('initGame uses player name in status text when provided', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: '' });
  const playerMarkEl = createElement({ value: 'X' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-mark': playerMarkEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      if (key !== 'ttt-state') {
        return null;
      }
      return JSON.stringify({
        mode: 'pvc',
        playerName: 'Casey',
        playerMark: 'X',
      });
    },
    setItem() {},
  };

  initGame(doc);

  assert.equal(statusEl.textContent, "Casey's turn!");

  global.localStorage = originalLocalStorage;
});

test('initGame applies second player name fallback for pvp', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerMarkEl = createElement({ value: 'X' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
      }[id];
    },
  };

  let persistedValue = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem(_key, value) {
      persistedValue = value;
    },
  };

  initGame(doc);
  playerTwoNameEl.value = '   ';
  playerTwoNameEl.dispatch('change', { target: playerTwoNameEl });

  const parsed = JSON.parse(persistedValue);
  assert.equal(parsed.playerTwoName, 'Player 2');

  global.localStorage = originalLocalStorage;
});

test('initGame shows active pvp player name and marker in turn status', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Alex' });
  const playerTwoNameEl = createElement({ value: 'Bailey' });
  const playerMarkEl = createElement({ value: 'X' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      if (key !== 'ttt-state') {
        return null;
      }
      return JSON.stringify({
        mode: 'pvp',
        playerName: 'Alex',
        playerTwoName: 'Bailey',
      });
    },
    setItem() {},
  };

  initGame(doc);
  assert.equal(statusEl.textContent, 'Alex (X) turn!');

  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  assert.equal(statusEl.textContent, 'Bailey (O) turn!');

  global.localStorage = originalLocalStorage;
});

test('initGame shows winner name in pvp outcome text', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Alex' });
  const playerTwoNameEl = createElement({ value: 'Bailey' });
  const playerMarkEl = createElement({ value: 'X' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      if (key !== 'ttt-state') {
        return null;
      }
      return JSON.stringify({
        mode: 'pvp',
        playerName: 'Alex',
        playerTwoName: 'Bailey',
      });
    },
    setItem() {},
  };

  initGame(doc);
  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '3' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '1' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '4' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '2' } } });

  assert.equal(statusEl.textContent, 'Alex wins!');

  global.localStorage = originalLocalStorage;
});

test('initGame keeps controls and status stable when switching between pvc and pvp', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Alex' });
  const playerTwoNameEl = createElement({ value: 'Bailey' });
  const playerMarkEl = createElement({ value: 'X' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      if (key !== 'ttt-state') {
        return null;
      }
      return JSON.stringify({
        mode: 'pvp',
        playerName: 'Alex',
        playerTwoName: 'Bailey',
      });
    },
    setItem() {},
  };

  initGame(doc);
  assert.equal(statusEl.textContent, 'Alex (X) turn!');

  modeEl.value = 'pvc';
  modeEl.dispatch('change', { target: modeEl });
  assert.equal(statusEl.textContent, "Alex's turn!");
  assert.equal(playerTwoNameEl.value, 'Bailey');

  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  assert.equal(statusEl.textContent, 'Alex (X) turn!');
  assert.equal(playerTwoNameEl.value, 'Bailey');

  global.localStorage = originalLocalStorage;
});

test('initGame uses Player 1 as the default player name in pvp mode', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerMarkEl = createElement({ value: 'X' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  initGame(doc);
  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });

  assert.equal(playerNameEl.value, 'Player 1');
  assert.equal(statusEl.textContent, 'Player 1 (X) turn!');

  global.localStorage = originalLocalStorage;
});

test('initGame maps visible default player input to Player 1 when switching to pvp', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerMarkEl = createElement({ value: 'X' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return JSON.stringify({
        mode: 'pvc',
        playerName: 'Alex',
      });
    },
    setItem() {},
  };

  initGame(doc);
  playerNameEl.value = 'Player';
  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });

  assert.equal(playerNameEl.value, 'Player 1');
  assert.equal(statusEl.textContent, 'Player 1 (X) turn!');

  global.localStorage = originalLocalStorage;
});

test('initGame supports keyboard navigation and move activation on board cells', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Alex' });
  const playerTwoNameEl = createElement({ value: 'Bailey' });
  const playerMarkEl = createElement({ value: 'X' });

  let focusedIndex = null;
  boardEl.querySelector = (selector) => {
    const match = selector.match(/data-index=\"(\d+)\"/);
    if (!match) {
      return null;
    }
    const index = Number(match[1]);
    return {
      focus() {
        focusedIndex = index;
      },
    };
  };

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return JSON.stringify({ mode: 'pvp' });
    },
    setItem() {},
  };

  initGame(doc);

  let prevented = false;
  boardEl.dispatch('keydown', {
    key: 'ArrowRight',
    target: { dataset: { index: '0' } },
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(focusedIndex, 1);

  boardEl.dispatch('keydown', {
    key: 'Enter',
    target: { dataset: { index: '0' } },
    preventDefault() {},
  });
  assert.match(boardEl.innerHTML, /data-index=\"0\">X<\/button>/);

  global.localStorage = originalLocalStorage;
});

test('keyboard activation accepts Spacebar alias for move input', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Alex' });
  const playerTwoNameEl = createElement({ value: 'Bailey' });
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return JSON.stringify({ mode: 'pvp' });
    },
    setItem() {},
  };

  initGame(doc);
  boardEl.dispatch('keydown', {
    key: 'Spacebar',
    target: { dataset: { index: '0' } },
    preventDefault() {},
  });

  assert.match(boardEl.innerHTML, /data-index=\"0\">X<\/button>/);

  global.localStorage = originalLocalStorage;
});

test('index.html keeps a visible high-contrast focus indicator on board cells', () => {
  const html = fs.readFileSync('./index.html', 'utf8');

  assert.match(html, /\.cell:focus-visible/);
  assert.match(html, /outline:\s*2px\s+solid/);
});

test('initGame status text updates for turn changes, invalid moves, and outcomes', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Alex' });
  const playerTwoNameEl = createElement({ value: 'Bailey' });
  const playerMarkEl = createElement({ value: 'X' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      if (key !== 'ttt-state') {
        return null;
      }
      return JSON.stringify({
        mode: 'pvp',
        playerName: 'Alex',
        playerTwoName: 'Bailey',
      });
    },
    setItem() {},
  };

  initGame(doc);
  assert.equal(statusEl.textContent, 'Alex (X) turn!');

  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  assert.equal(statusEl.textContent, 'Bailey (O) turn!');

  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  assert.equal(statusEl.textContent, 'Invalid move.');

  boardEl.dispatch('click', { target: { dataset: { index: '3' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '1' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '4' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '2' } } });
  assert.equal(statusEl.textContent, 'Alex wins!');

  global.localStorage = originalLocalStorage;
});

test('index.html defines semantic labels for settings and reset controls', () => {
  const html = fs.readFileSync('./index.html', 'utf8');

  assert.match(html, /<label[^>]+for=\"mode\"/);
  assert.match(html, /id=\"pvp-turn-order-note\"/);
  assert.match(html, /Player 1 is X and goes first\./);
  assert.match(html, /<label[^>]+for=\"difficulty\"/);
  assert.match(html, /<label[^>]+for=\"match-length\"/);
  assert.match(html, /id=\"play-again\"[^>]+aria-label=/);
  assert.match(html, /id=\"new-match\"[^>]+aria-label=/);
  assert.match(html, /id=\"reset-stats\"[^>]+aria-label=/);
});

test('filled cells expose move-pop animation hooks', () => {
  const board = [
    'X', null, null,
    null, 'O', null,
    null, null, null
  ];
  const html = renderBoardHtml(board);
  const page = fs.readFileSync('./index.html', 'utf8');

  assert.match(html, /class=\"cell is-filled\" data-index=\"0\">X/);
  assert.match(html, /class=\"cell is-filled\" data-index=\"4\">O/);
  assert.match(page, /\.cell\.is-filled/);
  assert.match(page, /@keyframes\s+cellPopIn/);
});

test('main.js maps outcome animation classes by player perspective marks', () => {
  const mainSource = fs.readFileSync('./main.js', 'utf8');

  assert.match(mainSource, /if \(winner === humanMark\)[\s\S]*setOutcomeState\('result-win'\)/);
  assert.match(mainSource, /if \(winner === computerMark\)[\s\S]*setOutcomeState\('result-loss'\)/);
  assert.match(mainSource, /setOutcomeState\('result-draw'\)/);
});

test('turn-transition cue hooks are defined without blocking input', () => {
  const html = fs.readFileSync('./index.html', 'utf8');
  const mainSource = fs.readFileSync('./main.js', 'utf8');

  assert.match(html, /#status\.is-turn-shift/);
  assert.match(html, /#board\.is-turn-shift\s+\.cell/);
  assert.match(html, /@keyframes\s+turnShiftPulse/);
  assert.match(mainSource, /is-turn-shift/);
});

test('reduced-motion styles disable non-essential animated effects', () => {
  const html = fs.readFileSync('./index.html', 'utf8');

  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.confetti-piece/);
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*animation:\s*none/);
});

test('initGame tracks analytics counters for total moves and completed rounds', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Alex' });
  const playerTwoNameEl = createElement({ value: 'Bailey' });
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  let persistedState = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem(key, value) {
      if (key === 'ttt-state') {
        persistedState = JSON.parse(value);
      }
    },
  };

  initGame(doc);
  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '3' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '1' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '4' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '2' } } });

  assert.equal(persistedState.analytics.totalMoves, 5);
  assert.equal(persistedState.analytics.totalRounds, 1);

  global.localStorage = originalLocalStorage;
});

test('initGame counts a draw as a completed played game in analytics', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Alex' });
  const playerTwoNameEl = createElement({ value: 'Bailey' });
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  let persistedState = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem(key, value) {
      if (key === 'ttt-state') {
        persistedState = JSON.parse(value);
      }
    },
  };

  initGame(doc);
  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  [0, 1, 2, 4, 3, 5, 7, 6, 8].forEach((index) => {
    boardEl.dispatch('click', { target: { dataset: { index: String(index) } } });
  });

  assert.equal(persistedState.analytics.totalRounds, 1);
  assert.equal(persistedState.analytics.decisiveRounds, 0);
  assert.equal(persistedState.analytics.totalMoves, 9);

  global.localStorage = originalLocalStorage;
});

test('initGame computes average moves per round from analytics counters', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Alex' });
  const playerTwoNameEl = createElement({ value: 'Bailey' });
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  let persistedState = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem(key, value) {
      if (key === 'ttt-state') {
        persistedState = JSON.parse(value);
      }
    },
  };

  initGame(doc);
  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '3' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '1' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '4' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '2' } } });

  assert.equal(persistedState.analytics.averageMovesPerRound, 5);

  global.localStorage = originalLocalStorage;
});

test('initGame computes first-player win rate for completed decisive rounds', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Alex' });
  const playerTwoNameEl = createElement({ value: 'Bailey' });
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  let persistedState = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem(key, value) {
      if (key === 'ttt-state') {
        persistedState = JSON.parse(value);
      }
    },
  };

  initGame(doc);
  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '3' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '1' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '4' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '2' } } });

  assert.equal(persistedState.analytics.firstPlayerWinRate, 1);

  global.localStorage = originalLocalStorage;
});

test('analytics panel renders safe default values before any games', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });
  const analyticsRoundsEl = createElement();
  const analyticsMovesEl = createElement();
  const analyticsDrawsEl = createElement();

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
        'analytics-total-rounds': analyticsRoundsEl,
        'analytics-total-moves': analyticsMovesEl,
        'analytics-draws': analyticsDrawsEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  initGame(doc);

  assert.equal(analyticsRoundsEl.textContent, '0');
  assert.equal(analyticsMovesEl.textContent, '0');
  assert.equal(analyticsDrawsEl.textContent, '0');

  global.localStorage = originalLocalStorage;
});

test('mobile styles keep control rows usable for the expanded settings set', () => {
  const html = fs.readFileSync('./index.html', 'utf8');

  assert.match(html, /@media\s*\(max-width:\s*640px\)[\s\S]*\.panel-actions\s*\{[\s\S]*flex-wrap:\s*wrap/);
  assert.match(html, /@media\s*\(max-width:\s*640px\)[\s\S]*\.panel-actions\s*>\s*\*\s*\{[\s\S]*width:\s*100%/);
});

test('desktop styles maintain clear hierarchy and spacing for controls', () => {
  const html = fs.readFileSync('./index.html', 'utf8');

  assert.match(html, /\.game-panel\s*\{[\s\S]*display:\s*grid/);
  assert.match(html, /\.game-panel\s*\{[\s\S]*gap:\s*12px/);
  assert.match(html, /\.panel-actions\s*\{[\s\S]*justify-content:\s*space-between/);
});

test('hard ai does not lose across repeated simulated manual trials', () => {
  function getWinnerForBoard(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  }

  function hasEmpty(board) {
    return board.some((cell) => cell === null);
  }

  function playOneTrial(randomFn) {
    const board = Array(9).fill(null);
    while (getWinnerForBoard(board) === null && hasEmpty(board)) {
      const humanMoves = board
        .map((cell, index) => (cell === null ? index : null))
        .filter((index) => index !== null);
      const humanPick = humanMoves[Math.floor(randomFn() * humanMoves.length)];
      board[humanPick] = 'X';
      if (getWinnerForBoard(board) !== null || !hasEmpty(board)) {
        break;
      }

      const aiPick = chooseComputerMove(board, { difficulty: 'hard' });
      if (aiPick !== null) {
        board[aiPick] = 'O';
      }
    }

    return getWinnerForBoard(board);
  }

  let seed = 12345;
  function deterministicRandom() {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  }

  let humanWins = 0;
  for (let i = 0; i < 75; i += 1) {
    const winner = playOneTrial(deterministicRandom);
    if (winner === 'X') {
      humanWins += 1;
    }
  }

  assert.equal(humanWins, 0);
});

test('single and bo3 match flow reaches configured game count and resets via new-match', () => {
  const gamesByLength = {
    single: 1,
    bo3: 3,
  };

  for (const [matchLength, totalGames] of Object.entries(gamesByLength)) {
    const game = createGame();
    game.mode = 'pvc';
    game.matchLength = matchLength;
    game.matchGamesPlayed = totalGames - 1;
    game.matchScore.playerWins = matchLength === 'single' ? 0 : Math.floor((totalGames - 1) / 2);
    game.board = [
      'X', 'X', null,
      null, 'O', null,
      null, null, null,
    ];

    assert.equal(playHumanTurn(game, 2), true);
    assert.equal(game.matchGamesPlayed, totalGames);
    assert.equal(game.isMatchOver, true);
    assert.equal(game.matchWinner, 'X');
  }

  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'bo3' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  let persistedValue = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return JSON.stringify({
        mode: 'pvc',
        matchLength: 'bo3',
        matchScore: { playerWins: 3, computerWins: 1 },
        matchGamesPlayed: 5,
        isMatchOver: true,
        matchWinner: 'X',
      });
    },
    setItem(_key, value) {
      persistedValue = value;
    },
  };

  initGame(doc);
  newMatchEl.dispatch('click');
  const parsed = JSON.parse(persistedValue);
  assert.equal(parsed.matchLength, 'bo3');
  assert.equal(parsed.isMatchOver, false);
  assert.equal(parsed.matchWinner, null);
  assert.equal(parsed.matchGamesPlayed, 0);
  assert.deepEqual(parsed.matchScore, { playerWins: 0, computerWins: 0 });

  global.localStorage = originalLocalStorage;
});

test('reload restores persisted settings and stats including analytics values', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });
  const analyticsRoundsEl = createElement();
  const analyticsMovesEl = createElement();
  const analyticsDrawsEl = createElement();

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
        'analytics-total-rounds': analyticsRoundsEl,
        'analytics-total-moves': analyticsMovesEl,
        'analytics-draws': analyticsDrawsEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return JSON.stringify({
        mode: 'pvp',
        playerName: 'Alex',
        playerTwoName: 'Bailey',
        playerMark: 'O',
        difficulty: 'hard',
        matchLength: 'bo3',
        scoreboard: {
          playerWins: 3,
          computerWins: 1,
          draws: 2,
          currentStreak: 1,
          bestStreak: 4,
        },
        analytics: {
          totalRounds: 6,
          totalMoves: 31,
          averageMovesPerRound: 5.1666666667,
          firstPlayerWins: 4,
          decisiveRounds: 5,
          firstPlayerWinRate: 0.8,
        },
      });
    },
    setItem() {},
  };

  initGame(doc);

  assert.equal(modeEl.value, 'pvp');
  assert.equal(playerNameEl.value, 'Alex');
  assert.equal(playerTwoNameEl.value, 'Bailey');
  assert.equal(playerMarkEl.value, 'O');
  assert.equal(difficultyEl.value, 'hard');
  assert.equal(matchLengthEl.value, 'bo3');
  assert.equal(analyticsRoundsEl.textContent, '6');
  assert.equal(analyticsMovesEl.textContent, '31');
  assert.equal(analyticsDrawsEl.textContent, '2');

  global.localStorage = originalLocalStorage;
});

test('play-again starts a new match when current match is over', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerTwoNameRowEl = createElement();
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'bo3' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-two-name-row': playerTwoNameRowEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  let persistedState = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return JSON.stringify({
        mode: 'pvc',
        matchLength: 'bo3',
        matchScore: { playerWins: 2, computerWins: 0 },
        matchGamesPlayed: 3,
        isMatchOver: true,
        matchWinner: 'X',
      });
    },
    setItem(_key, value) {
      persistedState = JSON.parse(value);
    },
  };

  initGame(doc);
  assert.equal(statusEl.textContent, 'You win the match!');
  assert.equal(playAgainEl.textContent, 'New Match');
  assert.match(playAgainEl.className, /\bis-ready\b/);
  playAgainEl.dispatch('click');
  assert.equal(statusEl.textContent, 'Your turn!');
  assert.equal(playAgainEl.textContent, 'Game One');
  assert.doesNotMatch(playAgainEl.className, /\bis-ready\b/);
  assert.equal(persistedState.isMatchOver, false);
  assert.equal(persistedState.matchWinner, null);
  assert.deepEqual(persistedState.matchScore, { playerWins: 0, computerWins: 0 });
  assert.equal(persistedState.matchGamesPlayed, 0);

  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  assert.match(boardEl.innerHTML, /data-index=\"0\">X<\/button>/);

  global.localStorage = originalLocalStorage;
});

test('play-again button label and pulse state update by match length after round completion', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Player 1' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerTwoNameRowEl = createElement();
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-two-name-row': playerTwoNameRowEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  initGame(doc, { loadPersistedState: false });
  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  assert.equal(playAgainEl.textContent, 'Single Game');
  assert.doesNotMatch(playAgainEl.className, /\bis-ready\b/);

  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '3' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '1' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '4' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '2' } } });

  assert.equal(playAgainEl.textContent, 'Single Game');
  assert.match(playAgainEl.className, /\bis-ready\b/);

  playAgainEl.dispatch('click');
  assert.equal(playAgainEl.textContent, 'Single Game');
  assert.doesNotMatch(playAgainEl.className, /\bis-ready\b/);

  matchLengthEl.value = 'bo3';
  matchLengthEl.dispatch('change', { target: matchLengthEl });
  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '3' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '1' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '4' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '2' } } });

  assert.equal(playAgainEl.textContent, 'Game Two');
  assert.match(playAgainEl.className, /\bis-ready\b/);
});

test('pvp winner styling is based on pvp outcome, not pvc marker preference', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvp' });
  const playerNameEl = createElement({ value: 'Alex' });
  const playerTwoNameEl = createElement({ value: 'Bailey' });
  const playerTwoNameRowEl = createElement();
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-two-name-row': playerTwoNameRowEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return JSON.stringify({
        mode: 'pvp',
        playerMark: 'O',
        playerName: 'Alex',
        playerTwoName: 'Bailey',
      });
    },
    setItem() {},
  };

  initGame(doc);
  boardEl.dispatch('click', { target: { dataset: { index: '0' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '3' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '1' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '4' } } });
  boardEl.dispatch('click', { target: { dataset: { index: '2' } } });

  assert.equal(statusEl.textContent, 'Alex wins!');
  assert.match(statusEl.className, /\bresult-win\b/);
  assert.doesNotMatch(statusEl.className, /\bresult-loss\b/);
  assert.match(boardEl.className, /\bresult-win\b/);
  assert.doesNotMatch(boardEl.className, /\bresult-loss\b/);

  global.localStorage = originalLocalStorage;
});

test('settings changes in pvc and pvp do not reset lifetime scoreboard or analytics', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  const expectedScoreboard = {
    playerWins: 4,
    computerWins: 2,
    draws: 1,
    currentStreak: 2,
    bestStreak: 3,
  };
  const expectedAnalytics = {
    totalRounds: 7,
    totalMoves: 39,
    averageMovesPerRound: 5.57,
    firstPlayerWins: 5,
    decisiveRounds: 6,
    firstPlayerWinRate: 0.8333333333,
  };

  let persistedValue = null;
  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem(key) {
      if (key !== 'ttt-state') {
        return null;
      }
      return JSON.stringify({
        mode: 'pvc',
        difficulty: 'medium',
        matchLength: 'single',
        scoreboard: expectedScoreboard,
        analytics: expectedAnalytics,
      });
    },
    setItem(_key, value) {
      persistedValue = value;
    },
  };

  initGame(doc);

  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  modeEl.value = 'pvc';
  modeEl.dispatch('change', { target: modeEl });
  matchLengthEl.value = 'bo3';
  matchLengthEl.dispatch('change', { target: matchLengthEl });

  const parsed = JSON.parse(persistedValue);
  assert.deepEqual(parsed.scoreboard, expectedScoreboard);
  assert.equal(parsed.analytics.totalRounds, expectedAnalytics.totalRounds);
  assert.equal(parsed.analytics.totalMoves, expectedAnalytics.totalMoves);
  assert.equal(parsed.analytics.firstPlayerWins, expectedAnalytics.firstPlayerWins);
  assert.equal(parsed.analytics.decisiveRounds, expectedAnalytics.decisiveRounds);
  assert.equal(parsed.analytics.averageMovesPerRound, expectedAnalytics.totalMoves / expectedAnalytics.totalRounds);
  assert.equal(parsed.analytics.firstPlayerWinRate, expectedAnalytics.firstPlayerWins / expectedAnalytics.decisiveRounds);

  global.localStorage = originalLocalStorage;
});

test('player 2 name control only shows in pvp mode', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerTwoNameRowEl = createElement({ hidden: false, disabled: false });
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-two-name-row': playerTwoNameRowEl,
        'player-mark': playerMarkEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  initGame(doc);
  assert.equal(playerTwoNameRowEl.hidden, true);
  assert.equal(playerTwoNameEl.disabled, true);

  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  assert.equal(playerTwoNameRowEl.hidden, false);
  assert.equal(playerTwoNameEl.disabled, false);

  modeEl.value = 'pvc';
  modeEl.dispatch('change', { target: modeEl });
  assert.equal(playerTwoNameRowEl.hidden, true);
  assert.equal(playerTwoNameEl.disabled, true);

  global.localStorage = originalLocalStorage;
});

test('difficulty control only shows in pvc mode', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerTwoNameRowEl = createElement({ hidden: false, disabled: false });
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyRowEl = createElement({ hidden: false, disabled: false });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-two-name-row': playerTwoNameRowEl,
        'player-mark': playerMarkEl,
        'difficulty-row': difficultyRowEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  initGame(doc);
  assert.equal(difficultyRowEl.hidden, false);
  assert.equal(difficultyEl.disabled, false);

  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  assert.equal(difficultyRowEl.hidden, true);
  assert.equal(difficultyEl.disabled, true);

  modeEl.value = 'pvc';
  modeEl.dispatch('change', { target: modeEl });
  assert.equal(difficultyRowEl.hidden, false);
  assert.equal(difficultyEl.disabled, false);

  global.localStorage = originalLocalStorage;
});

test('marker control only shows in pvc mode', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerTwoNameRowEl = createElement({ hidden: false, disabled: false });
  const playerMarkRowEl = createElement({ hidden: false, disabled: false });
  const playerMarkEl = createElement({ value: 'X' });
  const difficultyRowEl = createElement({ hidden: false, disabled: false });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-two-name-row': playerTwoNameRowEl,
        'player-mark-row': playerMarkRowEl,
        'player-mark': playerMarkEl,
        'difficulty-row': difficultyRowEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  initGame(doc);
  assert.equal(playerMarkRowEl.hidden, false);
  assert.equal(playerMarkEl.disabled, false);

  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  assert.equal(playerMarkRowEl.hidden, true);
  assert.equal(playerMarkEl.disabled, true);

  modeEl.value = 'pvc';
  modeEl.dispatch('change', { target: modeEl });
  assert.equal(playerMarkRowEl.hidden, false);
  assert.equal(playerMarkEl.disabled, false);

  global.localStorage = originalLocalStorage;
});

test('pvp turn-order note only shows in pvp mode', () => {
  const statusEl = createElement();
  const boardEl = createElement();
  const playAgainEl = createElement();
  const newMatchEl = createElement();
  const resetStatsEl = createElement();
  const modeEl = createElement({ value: 'pvc' });
  const playerNameEl = createElement({ value: 'Player' });
  const playerTwoNameEl = createElement({ value: 'Player 2' });
  const playerTwoNameRowEl = createElement({ hidden: false, disabled: false });
  const playerMarkRowEl = createElement({ hidden: false, disabled: false });
  const playerMarkEl = createElement({ value: 'X' });
  const pvpTurnOrderNoteEl = createElement({ hidden: false });
  const difficultyRowEl = createElement({ hidden: false, disabled: false });
  const difficultyEl = createElement({ value: 'medium' });
  const matchLengthEl = createElement({ value: 'single' });

  const doc = {
    getElementById(id) {
      return {
        status: statusEl,
        board: boardEl,
        'play-again': playAgainEl,
        'new-match': newMatchEl,
        'reset-stats': resetStatsEl,
        mode: modeEl,
        'player-name': playerNameEl,
        'player-two-name': playerTwoNameEl,
        'player-two-name-row': playerTwoNameRowEl,
        'player-mark-row': playerMarkRowEl,
        'player-mark': playerMarkEl,
        'pvp-turn-order-note': pvpTurnOrderNoteEl,
        'difficulty-row': difficultyRowEl,
        difficulty: difficultyEl,
        'match-length': matchLengthEl,
      }[id];
    },
  };

  const originalLocalStorage = global.localStorage;
  global.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  initGame(doc);
  assert.equal(pvpTurnOrderNoteEl.hidden, true);

  modeEl.value = 'pvp';
  modeEl.dispatch('change', { target: modeEl });
  assert.equal(pvpTurnOrderNoteEl.hidden, false);

  modeEl.value = 'pvc';
  modeEl.dispatch('change', { target: modeEl });
  assert.equal(pvpTurnOrderNoteEl.hidden, true);

  global.localStorage = originalLocalStorage;
});
