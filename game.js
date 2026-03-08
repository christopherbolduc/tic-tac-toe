(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  root.TTTGame = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function createGame() {
    return {
      mode: 'pvc',
      playerName: 'Player',
      playerTwoName: 'Player 2',
      playerMark: 'X',
      difficulty: 'medium',
      matchLength: 'single',
      currentTurn: 'X',
      scoreboard: {
        playerWins: 0,
        computerWins: 0,
        draws: 0,
        currentStreak: 0,
        bestStreak: 0,
      },
      analytics: {
        totalRounds: 0,
        totalMoves: 0,
        averageMovesPerRound: 0,
        firstPlayerWins: 0,
        decisiveRounds: 0,
        firstPlayerWinRate: 0,
      },
      matchScore: {
        playerWins: 0,
        computerWins: 0,
      },
      matchGamesPlayed: 0,
      hasScoredCurrentRound: false,
      isMatchOver: false,
      matchWinner: null,
      board: [
        null, null, null,
        null, null, null,
        null, null, null,
      ],
    };
  }

  function applyMove(game, index, mark) {
    if (game.board[index] !== null) {
      return false;
    }

    game.board[index] = mark;
    return true;
  }

  function getWinner(game) {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (const [a, b, c] of lines) {
      const mark = game.board[a];
      if (mark !== null && mark === game.board[b] && mark === game.board[c]) {
        return mark;
      }
    }

    return null;
  }

  function isDraw(game) {
    return getWinner(game) === null && game.board.every((cell) => cell !== null);
  }

  function resetGame(game) {
    game.currentTurn = 'X';
    game.hasScoredCurrentRound = false;
    game.board = [
      null, null, null,
      null, null, null,
      null, null, null,
    ];
  }

  return {
    applyMove,
    createGame,
    getWinner,
    isDraw,
    resetGame,
  };
}));
