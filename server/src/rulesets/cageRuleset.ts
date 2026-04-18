import type { Ruleset, BoardGrid, BoardMetadata, CellCoord } from 'shared'
import { baseRuleset } from './baseRuleset'

export const cageRuleset: Ruleset = {
  id: 'cage',
  name: 'Killer Sudoku',
  validate(board: BoardGrid, metadata: BoardMetadata, row: number, col: number, value: number): CellCoord[] {
    const baseConflicts = baseRuleset.validate(board, metadata, row, col, value)
    const cageConflicts: CellCoord[] = []

    const cages = metadata.cages ?? []
    for (const cage of cages) {
      const inCage = cage.cells.some(c => c.row === row && c.col === col)
      if (!inCage) continue

      // Check for duplicate digits in cage
      const values: number[] = []
      let hasDuplicate = false
      for (const cell of cage.cells) {
        const cellValue = (cell.row === row && cell.col === col) ? value : board[cell.row][cell.col].value
        if (cellValue !== null) {
          if (values.includes(cellValue)) {
            hasDuplicate = true
            break
          }
          values.push(cellValue)
        }
      }

      if (hasDuplicate) {
        cageConflicts.push(...cage.cells)
        continue
      }

      // Check sum only when fully filled
      const allFilled = cage.cells.every(cell => {
        const v = (cell.row === row && cell.col === col) ? value : board[cell.row][cell.col].value
        return v !== null
      })

      if (allFilled) {
        const sum = cage.cells.reduce((acc, cell) => {
          const v = (cell.row === row && cell.col === col) ? value : board[cell.row][cell.col].value
          return acc + (v as number)
        }, 0)
        if (sum !== cage.sum) {
          cageConflicts.push(...cage.cells)
        }
      }
    }

    const combined = [...baseConflicts, ...cageConflicts]
    const seen = new Set<string>()
    return combined.filter(coord => {
      const key = `${coord.row},${coord.col}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}
