(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  root.TTTAi = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const WINNING_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  function getWinner(board) {
    for (const [a, b, c] of WINNING_LINES) {
      const mark = board[a];
      if (mark !== null && mark === board[b] && mark === board[c]) {
        return mark;
      }
    }

    return null;
  }

  function isDraw(board) {
    return getWinner(board) === null && board.every((cell) => cell !== null);
  }

  function getWinningMove(board, mark) {
    for (const line of WINNING_LINES) {
      const marks = line.map((index) => board[index]);
      const markCount = marks.filter((cell) => cell === mark).length;
      const emptyCount = marks.filter((cell) => cell === null).length;

      if (markCount === 2 && emptyCount === 1) {
        const emptyIndexInLine = marks.indexOf(null);
        return line[emptyIndexInLine];
      }
    }

    return null;
  }

  function getAvailableIndexes(board) {
    return board
      .map((cell, index) => (cell === null ? index : null))
      .filter((index) => index !== null);
  }

  function pickFirstAvailable(board, indexes) {
    for (const index of indexes) {
      if (board[index] === null) {
        return index;
      }
    }

    return null;
  }

  function getRandomAvailable(board, randomFn) {
    const available = getAvailableIndexes(board);

    if (available.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(randomFn() * available.length);
    return available[randomIndex];
  }

  function getMinimaxMove(board, currentMark) {
    const winner = getWinner(board);
    if (winner === 'O') {
      return { score: 1, index: null };
    }
    if (winner === 'X') {
      return { score: -1, index: null };
    }
    if (isDraw(board)) {
      return { score: 0, index: null };
    }

    const available = getAvailableIndexes(board);
    let bestMove = { score: currentMark === 'O' ? -Infinity : Infinity, index: available[0] };

    for (const index of available) {
      board[index] = currentMark;
      const result = getMinimaxMove(board, currentMark === 'O' ? 'X' : 'O');
      board[index] = null;

      const candidate = { score: result.score, index };
      if (currentMark === 'O') {
        if (candidate.score > bestMove.score) {
          bestMove = candidate;
        }
      } else if (candidate.score < bestMove.score) {
        bestMove = candidate;
      }
    }

    return bestMove;
  }

  function chooseComputerMove(board, options = {}) {
    const randomFn = typeof options.randomFn === 'function' ? options.randomFn : Math.random;
    const difficulty = options.difficulty || 'medium';

    if (difficulty === 'easy') {
      return getRandomAvailable(board, randomFn);
    }

    if (difficulty === 'hard') {
      return getMinimaxMove(board.slice(), 'O').index;
    }

    const winMove = getWinningMove(board, 'O');
    if (winMove !== null) {
      return winMove;
    }

    const blockMove = getWinningMove(board, 'X');
    if (blockMove !== null) {
      return blockMove;
    }

    if (board[4] === null) {
      return 4;
    }

    const cornerMove = pickFirstAvailable(board, [0, 2, 6, 8]);
    if (cornerMove !== null) {
      return cornerMove;
    }

    return pickFirstAvailable(board, [1, 3, 5, 7]);
  }

  return {
    chooseComputerMove,
  };
}));
