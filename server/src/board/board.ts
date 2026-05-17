import type { BoardGrid, Cell, CellCoord } from 'shared'

function emptyCell(): Cell {
  return {
    value: null,
    isGiven: false,
    cornerNotes: [],
    centerNotes: [],
    isConflict: false,
  }
}

function cloneBoard(board: BoardGrid): BoardGrid {
  return board.map(row => row.map(cell => ({ ...cell, cornerNotes: [...cell.cornerNotes], centerNotes: [...cell.centerNotes] })))
}

export function createEmpty(): BoardGrid {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, emptyCell))
}

export function placeGiven(board: BoardGrid, row: number, col: number, value: number): BoardGrid {
  if (board[row][col].isGiven) throw new Error('Cell is already given')
  const next = cloneBoard(board)
  next[row][col] = { ...next[row][col], value, isGiven: true }
  return next
}

export function clearGiven(board: BoardGrid, row: number, col: number): BoardGrid {
  if (!board[row][col].isGiven) throw new Error('Cell is not given')
  const next = cloneBoard(board)
  next[row][col] = { ...next[row][col], value: null, isGiven: false }
  return next
}

export function placeDigit(board: BoardGrid, row: number, col: number, value: number, playerId: string): BoardGrid {
  if (board[row][col].isGiven) return board
  const next = cloneBoard(board)
  next[row][col] = { ...next[row][col], value, placedBy: playerId, cornerNotes: [], centerNotes: [] }
  return next
}

export function clearCell(board: BoardGrid, row: number, col: number): BoardGrid {
  if (board[row][col].isGiven) return board
  const next = cloneBoard(board)
  const cell = { ...next[row][col], value: null, cornerNotes: [], centerNotes: [] }
  delete cell.placedBy
  next[row][col] = cell
  return next
}

export function toggleNote(board: BoardGrid, row: number, col: number, noteType: 'corner' | 'center', value: number): BoardGrid {
  const next = cloneBoard(board)
  const key = noteType === 'corner' ? 'cornerNotes' : 'centerNotes'
  const notes = next[row][col][key]
  if (notes.includes(value)) {
    next[row][col] = { ...next[row][col], [key]: notes.filter(n => n !== value) }
  } else {
    next[row][col] = { ...next[row][col], [key]: [...notes, value] }
  }
  return next
}

export function isComplete(board: BoardGrid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = board[r][c]
      if (cell.isConflict) return false
      if (!cell.isGiven && cell.value === null) return false
    }
  }
  return true
}

export function applyConflicts(board: BoardGrid, conflicts: CellCoord[]): BoardGrid {
  const conflictSet = new Set(conflicts.map(c => `${c.row},${c.col}`))
  return board.map((row, r) =>
    row.map((cell, c) => ({ ...cell, cornerNotes: [...cell.cornerNotes], centerNotes: [...cell.centerNotes], isConflict: conflictSet.has(`${r},${c}`) }))
  )
}

export function clearConflicts(board: BoardGrid): BoardGrid {
  return applyConflicts(board, [])
}
