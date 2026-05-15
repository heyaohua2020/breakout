// ============================================
// 五子棋游戏核心逻辑
// ============================================

const Game = (function() {
  const BOARD_SIZE = 15;
  const EMPTY = 0;
  const BLACK = 1;  // 玩家
  const WHITE = 2;  // AI
  
  let board = [];
  let history = [];
  let currentPlayer = BLACK;
  let gameOver = false;
  let cellSize = 40;
  let boardPadding = 30;
  let canvas = null;
  let ctx = null;
  
  // 初始化游戏
  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // 设置画布大小
    canvas.width = cellSize * (BOARD_SIZE - 1) + boardPadding * 2;
    canvas.height = cellSize * (BOARD_SIZE - 1) + boardPadding * 2;
    
    // 初始化棋盘
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
    history = [];
    currentPlayer = BLACK;
    gameOver = false;
    
    // 绘制棋盘
    drawBoard();
    
    // 绑定点击事件
    canvas.onclick = handleClick;
    
    // 显示状态
    updateStatus();
  }
  
  // 绘制棋盘
  function drawBoard() {
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1;
    
    // 绘制网格线
    for (let i = 0; i < BOARD_SIZE; i++) {
      // 横线
      ctx.beginPath();
      ctx.moveTo(boardPadding, boardPadding + i * cellSize);
      ctx.lineTo(canvas.width - boardPadding, boardPadding + i * cellSize);
      ctx.stroke();
      
      // 竖线
      ctx.beginPath();
      ctx.moveTo(boardPadding + i * cellSize, boardPadding);
      ctx.lineTo(boardPadding + i * cellSize, canvas.height - boardPadding);
      ctx.stroke();
    }
    
    // 绘制天元和星位
    const starPoints = [3, 7, 11];
    starPoints.forEach(x => {
      starPoints.forEach(y => {
        ctx.beginPath();
        ctx.arc(boardPadding + x * cellSize, boardPadding + y * cellSize, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#8B4513';
        ctx.fill();
      });
    });
  }
  
  // 绘制棋子
  function drawPiece(x, y, color) {
    const centerX = boardPadding + x * cellSize;
    const centerY = boardPadding + y * cellSize;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, cellSize / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = color === BLACK ? '#000' : '#FFF';
    ctx.fill();
    
    // 棋子高光效果
    ctx.beginPath();
    ctx.arc(centerX - cellSize / 4, centerY - cellSize / 4, cellSize / 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    
    // 棋子阴影
    ctx.beginPath();
    ctx.arc(centerX + cellSize / 4, centerY + cellSize / 4, cellSize / 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
  }
  
  // 绘制落子动画
  function drawPieceAnimation(x, y, color, progress) {
    const centerX = boardPadding + x * cellSize;
    const centerY = boardPadding + y * cellSize;
    const targetRadius = cellSize / 2 - 2;
    const currentRadius = targetRadius * progress;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
    ctx.fillStyle = color === BLACK ? '#000' : '#FFF';
    ctx.fill();
  }
  
  // 处理点击事件
  function handleClick(e) {
    if (gameOver || currentPlayer !== BLACK) {
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left - boardPadding;
    const clickY = e.clientY - rect.top - boardPadding;
    
    // 计算最近的交叉点
    const x = Math.round(clickX / cellSize);
    const y = Math.round(clickY / cellSize);
    
    // 检查是否在棋盘范围内
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
      return;
    }
    
    // 检查该位置是否已有棋子
    if (board[y][x] !== EMPTY) {
      return;
    }
    
    // 落子
    makeMove(x, y, BLACK);
    
    // 检查胜负
    if (checkWin(x, y, BLACK)) {
      gameOver = true;
      updateStatus();
      return;
    }
    
    // 切换玩家
    currentPlayer = WHITE;
    updateStatus();
    
    // AI 落子
    setTimeout(makeAIMove, 300);
  }
  
  // 执行落子
  function makeMove(x, y, player) {
    board[y][x] = player;
    history.push({x, y, player});
  }
  
  // 悔棋
  function undo() {
    if (gameOver || history.length === 0) {
      return;
    }
    
    const lastMove = history.pop();
    board[lastMove.y][lastMove.x] = EMPTY;
    currentPlayer = lastMove.player === BLACK ? BLACK : WHITE;
    gameOver = false;
    
    // 重绘棋盘
    drawBoard();
    history.forEach(move => {
      drawPiece(move.x, move.y, move.player === BLACK ? '#000' : '#FFF');
    });
    
    updateStatus();
  }
  
  // 重新开始
  function restart() {
    if (confirm('确定要重新开始吗？')) {
      init();
    }
  }
  
  // 检查是否获胜
  function checkWin(x, y, player) {
    const directions = [
      [1, 0],   // 横向
      [0, 1],   // 纵向
      [1, 1],   // 斜向
      [1, -1]   // 反斜向
    ];
    
    for (const [dx, dy] of directions) {
      let count = 1;
      
      // 正向扩展
      let i = 1;
      while (true) {
        const nx = x + dx * i;
        const ny = y + dy * i;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
        if (board[ny][nx] === player) count++;
        else break;
        i++;
      }
      
      // 反向扩展
      i = 1;
      while (true) {
        const nx = x - dx * i;
        const ny = y - dy * i;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
        if (board[ny][nx] === player) count++;
        else break;
        i++;
      }
      
      if (count >= 5) return true;
    }
    
    return false;
  }
  
  // 获取最佳着点（AI）
  function getBestMove() {
    return aiModule.getBestMove(board);
  }
  
  // AI 落子
  function makeAIMove() {
    if (gameOver) return;
    
    const move = getBestMove();
    if (move) {
      makeMove(move.x, move.y, WHITE);
      
      if (checkWin(move.x, move.y, WHITE)) {
        gameOver = true;
        updateStatus();
        return;
      }
      
      currentPlayer = BLACK;
      updateStatus();
    }
  }
  
  // 更新状态显示
  function updateStatus() {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      if (gameOver) {
        statusEl.innerHTML = '<span style="color: red;">' + 
          (currentPlayer === BLACK ? '黑方' : '白方') + ' 获胜！</span>' +
          ' <button onclick="game.undo()">悔棋</button> ' +
          '<button onclick="game.restart()">重新开始</button>';
      } else {
        const turnText = currentPlayer === BLACK ? '黑方落子' : 'AI 思考中...';
        statusEl.innerHTML = '<span style="color: ' + 
          (currentPlayer === BLACK ? 'black' : '#666') + ';">' + turnText + '</span> ' +
          '<button onclick="game.undo()">悔棋</button> ' +
          '<button onclick="game.restart()">重新开始</button>';
      }
    }
  }
  
  return {
    init,
    undo,
    restart
  };
})();
