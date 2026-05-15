// ============================================
// 五子棋 AI 模块 - Minimax + Alpha-Beta 剪枝
// ============================================

const aiModule = (function() {
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  
  // 评估函数 - 计算棋局分数
  function evaluateBoard(board) {
    let score = 0;
    
    // 评估所有可能的连续棋型
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (board[y][x] !== EMPTY) {
          // 四个方向评估
          score += evaluateDirection(board, x, y, 1, 0, board[y][x]);  // 横向
          score += evaluateDirection(board, x, y, 0, 1, board[y][x]);  // 纵向
          score += evaluateDirection(board, x, y, 1, 1, board[y][x]);  // 斜向
          score += evaluateDirection(board, x, y, 1, -1, board[y][x]); // 反斜向
        }
      }
    }
    
    return score;
  }
  
  // 评估单个方向上的棋型
  function evaluateDirection(board, x, y, dx, dy, color) {
    let score = 0;
    const directions = [
      {name: 'empty', score: 0},
      {name: '2', score: 10},
      {name: '3', score: 100},
      {name: '4', score: 1000},
      {name: '5', score: 100000}
    ];
    
    // 向两个方向扩展
    for (let dir of [1, -1]) {
      let count = 0;
      let blocked = 0;
      
      // 正向
      let i = 1;
      while (true) {
        const nx = x + dx * dir * i;
        const ny = y + dy * dir * i;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) {
          blocked++;
          break;
        }
        if (board[ny][nx] === EMPTY) {
          count = 0;
          blocked = 0;
        } else if (board[ny][nx] === color) {
          count++;
        } else {
          blocked++;
          count = 0;
        }
        i++;
      }
      
      // 反向
      i = 1;
      while (true) {
        const nx = x - dx * dir * i;
        const ny = y - dy * dir * i;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) {
          blocked++;
          break;
        }
        if (board[ny][nx] === EMPTY) {
          count = 0;
          blocked = 0;
        } else if (board[ny][nx] === color) {
          count++;
        } else {
          blocked++;
          count = 0;
        }
        i++;
      }
      
      if (count >= 5) {
        score += directions[5].score * (3 - blocked);
      } else if (count === 4) {
        if (blocked === 0) {
          score += directions[4].score * (3 - blocked); // 活四
        } else {
          score += directions[3].score * (3 - blocked); // 冲四
        }
      } else if (count === 3) {
        if (blocked === 0) {
          score += directions[3].score * (3 - blocked); // 活三
        } else {
          score += directions[2].score * (3 - blocked); // 眠三
        }
      } else if (count === 2) {
        score += directions[2].score * (3 - blocked);
      } else if (count === 1) {
        score += directions[1].score;
      }
    }
    
    return score;
  }
  
  // 获取所有可行位置
  function getValidMoves(board) {
    const moves = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (board[y][x] === EMPTY) {
          moves.push({x, y});
        }
      }
    }
    return moves;
  }
  
  // Minimax 算法递归函数
  function minimax(board, depth, alpha, beta, isMaximizing) {
    // 递归终止条件
    if (depth === 0) {
      return evaluateBoard(board);
    }
    
    const moves = getValidMoves(board);
    
    if (isMaximizing) {
      // AI 回合（白方，最大化分数）
      let maxScore = -Infinity;
      let bestMove = null;
      
      // 按位置优先级排序（中心优先）
      moves.sort((a, b) => {
        const distA = Math.abs(a.x - 7) + Math.abs(a.y - 7);
        const distB = Math.abs(b.x - 7) + Math.abs(b.y - 7);
        return distA - distB;
      });
      
      for (const move of moves) {
        board[move.y][move.x] = WHITE;
        const score = minimax(board, depth - 1, alpha, beta, false);
        board[move.y][move.x] = EMPTY;
        
        if (score > maxScore) {
          maxScore = score;
          bestMove = move;
        }
        
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break; // Alpha-Beta 剪枝
      }
      
      return bestMove ? maxScore : 0;
    } else {
      // 玩家回合（黑方，最小化分数）
      let minScore = Infinity;
      let bestMove = null;
      
      // 按位置优先级排序
      moves.sort((a, b) => {
        const distA = Math.abs(a.x - 7) + Math.abs(a.y - 7);
        const distB = Math.abs(b.x - 7) + Math.abs(b.y - 7);
        return distA - distB;
      });
      
      for (const move of moves) {
        board[move.y][move.x] = BLACK;
        const score = minimax(board, depth - 1, alpha, beta, true);
        board[move.y][move.x] = EMPTY;
        
        if (score < minScore) {
          minScore = score;
          bestMove = move;
        }
        
        beta = Math.min(beta, score);
        if (beta <= alpha) break; // Alpha-Beta 剪枝
      }
      
      return bestMove ? minScore : 0;
    }
  }
  
  // 获取最佳着点
  function getBestMove(board) {
    const moves = getValidMoves(board);
    if (moves.length === 0) return null;
    
    // 第一手棋走中心
    if (moves.length === 1) return moves[0];
    
    let bestMove = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;
    let beta = Infinity;
    
    // 按位置优先级排序
    moves.sort((a, b) => {
      const distA = Math.abs(a.x - 7) + Math.abs(a.y - 7);
      const distB = Math.abs(b.x - 7) + Math.abs(b.y - 7);
      return distA - distB;
    });
    
    // 递归深度控制在 3-4 层
    const depth = 3;
    
    for (const move of moves) {
      board[move.y][move.x] = WHITE;
      
      if (checkWin(board, move.x, move.y, WHITE)) {
        board[move.y][move.x] = EMPTY;
        return move; // 直接获胜，立即返回
      }
      
      const score = minimax(board, depth - 1, alpha, beta, false);
      board[move.y][move.x] = EMPTY;
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break; // Alpha-Beta 剪枝
    }
    
    return bestMove || moves[0];
  }
  
  // 检查棋盘上是否某位置获胜
  function checkWin(board, x, y, color) {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    
    for (const [dx, dy] of directions) {
      let count = 1;
      
      // 正向
      let i = 1;
      while (true) {
        const nx = x + dx * i;
        const ny = y + dy * i;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
        if (board[ny][nx] === color) count++;
        else break;
        i++;
      }
      
      // 反向
      i = 1;
      while (true) {
        const nx = x - dx * i;
        const ny = y - dy * i;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
        if (board[ny][nx] === color) count++;
        else break;
        i++;
      }
      
      if (count >= 5) return true;
    }
    
    return false;
  }
  
  return {
    getBestMove
  };
})();
