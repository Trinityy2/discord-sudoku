import { describe, it, expect } from 'vitest'
import { cageRuleset } from './cageRuleset'
import { createEmpty, placeDigit } from '../board/board'
import type { BoardMetadata } from 'shared'

describe('cageRuleset', () => {
  it('cell not in any cage → no conflict', () => {
    const board = createEmpty()
    const meta: BoardMetadata = { cages: [{ cells: [{ row: 5, col: 5 }, { row: 5, col: 6 }], sum: 10 }] }
    const conflicts = cageRuleset.validate(board, meta, 0, 0, 5)
    expect(conflicts).toEqual([])
  })

  it('duplicate digit in same cage → all cells in cage are conflicts', () => {
    let board = createEmpty()
    board = placeDigit(board, 0, 0, 5, 'p1')
    const meta: BoardMetadata = { cages: [{ cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }], sum: 10 }] }
    const conflicts = cageRuleset.validate(board, meta, 0, 1, 5)
    expect(conflicts.some(c => c.row === 0 && c.col === 0)).toBe(true)
    expect(conflicts.some(c => c.row === 0 && c.col === 1)).toBe(true)
  })

  it('cage not fully filled → no sum check → valid', () => {
    let board = createEmpty()
    board = placeDigit(board, 0, 0, 3, 'p1')
    const meta: BoardMetadata = { cages: [{ cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }], sum: 15 }] }
    const conflicts = cageRuleset.validate(board, meta, 0, 1, 4)
    expect(conflicts).toEqual([])
  })

  it('cage fully filled, correct sum → valid, returns []', () => {
    let board = createEmpty()
    board = placeDigit(board, 0, 0, 3, 'p1')
    const meta: BoardMetadata = { cages: [{ cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }], sum: 7 }] }
    const conflicts = cageRuleset.validate(board, meta, 0, 1, 4)
    expect(conflicts).toEqual([])
  })

  it('cage fully filled, wrong sum → all cells in cage as conflicts', () => {
    let board = createEmpty()
    board = placeDigit(board, 0, 0, 3, 'p1')
    const meta: BoardMetadata = { cages: [{ cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }], sum: 10 }] }
    const conflicts = cageRuleset.validate(board, meta, 0, 1, 4)
    expect(conflicts.some(c => c.row === 0 && c.col === 0)).toBe(true)
    expect(conflicts.some(c => c.row === 0 && c.col === 1)).toBe(true)
  })
})
