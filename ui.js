(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  root.TTTUi = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function renderBoardHtml(board) {
    return board
      .map((cell, index) => {
        const className = cell === null ? 'cell' : 'cell is-filled';
        return `<button class="${className}" data-index="${index}">${cell ?? ''}</button>`;
      })
      .join('');
  }

  function setStatusText(statusEl, text) {
    statusEl.textContent = text;
  }

  function getClickedIndex(event) {
    const indexText = event.target && event.target.dataset && event.target.dataset.index;
    if (indexText === undefined) {
      return null;
    }

    return Number(indexText);
  }

  return {
    getClickedIndex,
    renderBoardHtml,
    setStatusText,
  };
}));
