import type { Ruleset, BoardGrid, BoardMetadata, CellCoord } from 'shared'
import { baseRuleset } from './baseRuleset'

export const thermometerRuleset: Ruleset = {
  id: 'thermometer',
  name: 'Thermometer Sudoku',
  validate(board: BoardGrid, metadata: BoardMetadata, row: number, col: number, value: number): CellCoord[] {
    const baseConflicts = baseRuleset.validate(board, metadata, row, col, value)
    const thermoConflicts: CellCoord[] = []

    const thermometers = metadata.thermometers ?? []
    for (const thermo of thermometers) {
      const idx = thermo.findIndex(c => c.row === row && c.col === col)
      if (idx === -1) continue

      // Check against previous cells
      for (let i = 0; i < idx; i++) {
        const prevCell = board[thermo[i].row][thermo[i].col]
        if (prevCell.value !== null && prevCell.value >= value) {
          thermoConflicts.push(thermo[i])
          thermoConflicts.push({ row, col })
        }
      }

      // Check against next cells
      for (let i = idx + 1; i < thermo.length; i++) {
        const nextCell = board[thermo[i].row][thermo[i].col]
        if (nextCell.value !== null && nextCell.value <= value) {
          thermoConflicts.push(thermo[i])
          thermoConflicts.push({ row, col })
        }
      }
    }

    const combined = [...baseConflicts, ...thermoConflicts]
    const seen = new Set<string>()
    return combined.filter(coord => {
      const key = `${coord.row},${coord.col}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}
