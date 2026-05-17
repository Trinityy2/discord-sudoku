export interface CellCoord { row: number; col: number }

export interface Cell {
  value: number | null
  isGiven: boolean
  cornerNotes: number[]
  centerNotes: number[]
  isConflict: boolean
  placedBy?: string
}

export type BoardGrid = Cell[][]

export interface BoardMetadata {
  thermometers?: CellCoord[][]
  cages?: { cells: CellCoord[]; sum: number }[]
}
