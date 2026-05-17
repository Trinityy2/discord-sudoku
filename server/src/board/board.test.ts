import { describe, it, expect } from 'vitest'
import {
  createEmpty,
  placeGiven,
  clearGiven,
  placeDigit,
  clearCell,
  toggleNote,
  isComplete,
  applyConflicts,
  clearConflicts,
} from './board'
import type { BoardGrid } from 'shared'

describe('createEmpty', () => {
  it('returns 9×9 array with all value: null, isGiven: false, notes []', () => {
    const board = createEmpty()
    expect(board).toHaveLength(9)
    board.forEach(row => {
      expect(row).toHaveLength(9)
      row.forEach(cell => {
        expect(cell.value).toBeNull()
        expect(cell.isGiven).toBe(false)
        expect(cell.cornerNotes).toEqual([])
        expect(cell.centerNotes).toEqual([])
        expect(cell.isConflict).toBe(false)
      })
    })
  })
})

describe('placeGiven', () => {
  it('sets value and isGiven: true at correct coords', () => {
    const board = createEmpty()
    const next = placeGiven(board, 2, 3, 5)
    expect(next[2][3].value).toBe(5)
    expect(next[2][3].isGiven).toBe(true)
  })

  it('is immutable — original board unchanged', () => {
    const board = createEmpty()
    placeGiven(board, 0, 0, 1)
    expect(board[0][0].value).toBeNull()
  })

  it('throws if cell is already given', () => {
    const board = placeGiven(createEmpty(), 0, 0, 1)
    expect(() => placeGiven(board, 0, 0, 2)).toThrow()
  })
})

describe('clearGiven', () => {
  it('clears value and isGiven', () => {
    const board = placeGiven(createEmpty(), 1, 1, 7)
    const next = clearGiven(board, 1, 1)
    expect(next[1][1].value).toBeNull()
    expect(next[1][1].isGiven).toBe(false)
  })

  it('throws if cell is not given', () => {
    const board = createEmpty()
    expect(() => clearGiven(board, 0, 0)).toThrow()
  })
})

describe('placeDigit', () => {
  it('sets value and placedBy, clears notes', () => {
    let board = createEmpty()
    board = toggleNote(board, 0, 0, 'corner', 3)
    board = toggleNote(board, 0, 0, 'center', 5)
    board = placeDigit(board, 0, 0, 7, 'player1')
    expect(board[0][0].value).toBe(7)
    expect(board[0][0].placedBy).toBe('player1')
    expect(board[0][0].cornerNotes).toEqual([])
    expect(board[0][0].centerNotes).toEqual([])
  })

  it('is a no-op when cell is isGiven: true', () => {
    const board = placeGiven(createEmpty(), 0, 0, 5)
    const next = placeDigit(board, 0, 0, 9, 'player1')
    expect(next[0][0].value).toBe(5)
    expect(next[0][0].isGiven).toBe(true)
  })

  it('is immutable — original board unchanged', () => {
    const board = createEmpty()
    placeDigit(board, 0, 0, 1, 'p1')
    expect(board[0][0].value).toBeNull()
  })
})

describe('clearCell', () => {
  it('clears value, notes, and placedBy on a non-given cell', () => {
    let board = createEmpty()
    board = placeDigit(board, 0, 0, 5, 'p1')
    board = clearCell(board, 0, 0)
    expect(board[0][0].value).toBeNull()
    expect(board[0][0].placedBy).toBeUndefined()
  })

  it('is a no-op on a given cell', () => {
    const board = placeGiven(createEmpty(), 0, 0, 5)
    const next = clearCell(board, 0, 0)
    expect(next[0][0].value).toBe(5)
    expect(next[0][0].isGiven).toBe(true)
  })
})

describe('toggleNote', () => {
  it('adds a corner note when not present', () => {
    const board = toggleNote(createEmpty(), 0, 0, 'corner', 3)
    expect(board[0][0].cornerNotes).toContain(3)
  })

  it('removes a corner note when already present', () => {
    let board = toggleNote(createEmpty(), 0, 0, 'corner', 3)
    board = toggleNote(board, 0, 0, 'corner', 3)
    expect(board[0][0].cornerNotes).not.toContain(3)
  })

  it('works independently for center notes', () => {
    let board = toggleNote(createEmpty(), 0, 0, 'center', 5)
    expect(board[0][0].centerNotes).toContain(5)
    board = toggleNote(board, 0, 0, 'center', 5)
    expect(board[0][0].centerNotes).not.toContain(5)
  })
})

describe('isComplete', () => {
  function fillBoard(board: BoardGrid): BoardGrid {
    let b = board
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!b[r][c].isGiven && b[r][c].value === null) {
          b = placeDigit(b, r, c, 1, 'p1')
        }
      }
    }
    return b
  }

  it('returns false when any non-given cell has value: null', () => {
    const board = createEmpty()
    expect(isComplete(board)).toBe(false)
  })

  it('returns false when any cell has isConflict: true', () => {
    let board = fillBoard(createEmpty())
    board = applyConflicts(board, [{ row: 0, col: 0 }])
    expect(isComplete(board)).toBe(false)
  })

  it('returns true when all non-given cells are filled and no conflicts', () => {
    const board = fillBoard(createEmpty())
    expect(isComplete(board)).toBe(true)
  })
})

describe('applyConflicts', () => {
  it('marks only listed cells as isConflict: true, all others false', () => {
    const board = applyConflicts(createEmpty(), [{ row: 0, col: 0 }, { row: 1, col: 1 }])
    expect(board[0][0].isConflict).toBe(true)
    expect(board[1][1].isConflict).toBe(true)
    expect(board[0][1].isConflict).toBe(false)
  })
})

describe('clearConflicts', () => {
  it('sets all cells to isConflict: false', () => {
    let board = applyConflicts(createEmpty(), [{ row: 0, col: 0 }])
    board = clearConflicts(board)
    expect(board[0][0].isConflict).toBe(false)
  })
})
