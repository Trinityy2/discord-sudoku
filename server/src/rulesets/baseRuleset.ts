import type { Ruleset, BoardGrid, BoardMetadata, CellCoord } from 'shared'

function getBoxStart(n: number): number {
  return Math.floor(n / 3) * 3
}

export const baseRuleset: Ruleset = {
  id: 'base',
  name: 'Standard Sudoku',
  validate(board: BoardGrid, _metadata: BoardMetadata, row: number, col: number, value: number): CellCoord[] {
    const conflicts: CellCoord[] = []

    // Check row
    for (let c = 0; c < 9; c++) {
      if (c !== col && board[row][c].value === value) {
        conflicts.push({ row, col: c })
        conflicts.push({ row, col })
      }
    }

    // Check column
    for (let r = 0; r < 9; r++) {
      if (r !== row && board[r][col].value === value) {
        conflicts.push({ row: r, col })
        conflicts.push({ row, col })
      }
    }

    // Check 3x3 box
    const boxRowStart = getBoxStart(row)
    const boxColStart = getBoxStart(col)
    for (let r = boxRowStart; r < boxRowStart + 3; r++) {
      for (let c = boxColStart; c < boxColStart + 3; c++) {
        if ((r !== row || c !== col) && board[r][c].value === value) {
          conflicts.push({ row: r, col: c })
          conflicts.push({ row, col })
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>()
    return conflicts.filter(coord => {
      const key = `${coord.row},${coord.col}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}
