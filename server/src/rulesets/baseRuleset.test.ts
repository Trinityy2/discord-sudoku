import { describe, it, expect } from 'vitest'
import { baseRuleset } from './baseRuleset'
import { createEmpty, placeGiven, placeDigit } from '../board/board'
import type { BoardGrid } from 'shared'

describe('baseRuleset', () => {
  it('valid placement — no duplicates → returns []', () => {
    const board = createEmpty()
    const conflicts = baseRuleset.validate(board, {}, 0, 0, 5)
    expect(conflicts).toEqual([])
  })

  it('row conflict — same value in same row', () => {
    let board = createEmpty()
    board = placeDigit(board, 0, 5, 5, 'p1')
    const conflicts = baseRuleset.validate(board, {}, 0, 0, 5)
    expect(conflicts.some(c => c.row === 0 && c.col === 5)).toBe(true)
    expect(conflicts.some(c => c.row === 0 && c.col === 0)).toBe(true)
  })

  it('column conflict — same value in same column', () => {
    let board = createEmpty()
    board = placeDigit(board, 5, 0, 5, 'p1')
    const conflicts = baseRuleset.validate(board, {}, 0, 0, 5)
    expect(conflicts.some(c => c.row === 5 && c.col === 0)).toBe(true)
    expect(conflicts.some(c => c.row === 0 && c.col === 0)).toBe(true)
  })

  it('box conflict — same value in same 3×3 box', () => {
    let board = createEmpty()
    board = placeDigit(board, 1, 1, 5, 'p1')
    const conflicts = baseRuleset.validate(board, {}, 0, 0, 5)
    expect(conflicts.some(c => c.row === 1 && c.col === 1)).toBe(true)
    expect(conflicts.some(c => c.row === 0 && c.col === 0)).toBe(true)
  })

  it('multiple conflicts — row + col both conflict → all returned (deduped)', () => {
    let board = createEmpty()
    board = placeDigit(board, 0, 5, 5, 'p1') // row conflict
    board = placeDigit(board, 5, 0, 5, 'p1') // col conflict
    const conflicts = baseRuleset.validate(board, {}, 0, 0, 5)
    // All three cells should appear
    expect(conflicts.some(c => c.row === 0 && c.col === 5)).toBe(true)
    expect(conflicts.some(c => c.row === 5 && c.col === 0)).toBe(true)
    expect(conflicts.some(c => c.row === 0 && c.col === 0)).toBe(true)
    // No duplicates
    const keys = conflicts.map(c => `${c.row},${c.col}`)
    expect(keys.length).toBe(new Set(keys).size)
  })

  it('given cells count as conflict sources', () => {
    let board = createEmpty()
    board = placeGiven(board, 0, 5, 5)
    const conflicts = baseRuleset.validate(board, {}, 0, 0, 5)
    expect(conflicts.some(c => c.row === 0 && c.col === 5)).toBe(true)
  })
})
