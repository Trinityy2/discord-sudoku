import type { BoardGrid, BoardMetadata, CellCoord } from './board'

export interface Ruleset {
  id: string
  name: string
  validate(
    board: BoardGrid,
    metadata: BoardMetadata,
    row: number,
    col: number,
    value: number
  ): CellCoord[]
  renderHints?: unknown
}
