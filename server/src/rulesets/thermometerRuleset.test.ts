import { describe, it, expect } from 'vitest'
import { thermometerRuleset } from './thermometerRuleset'
import { createEmpty, placeDigit } from '../board/board'
import type { BoardMetadata } from 'shared'

describe('thermometerRuleset', () => {
  it('cell not on any thermometer → no conflict', () => {
    const board = createEmpty()
    const meta: BoardMetadata = { thermometers: [
      [{ row: 5, col: 5 }, { row: 5, col: 6 }]
    ]}
    const conflicts = thermometerRuleset.validate(board, meta, 0, 0, 3)
    expect(conflicts).toEqual([])
  })

  it('single-cell thermometer → always valid', () => {
    const board = createEmpty()
    const meta: BoardMetadata = { thermometers: [[{ row: 0, col: 0 }]] }
    const conflicts = thermometerRuleset.validate(board, meta, 0, 0, 5)
    expect(conflicts).toEqual([])
  })

  it('strictly increasing values → valid, returns []', () => {
    let board = createEmpty()
    board = placeDigit(board, 0, 0, 3, 'p1')
    const meta: BoardMetadata = { thermometers: [
      [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]
    ]}
    const conflicts = thermometerRuleset.validate(board, meta, 0, 1, 5)
    expect(conflicts).toEqual([])
  })

  it('equal values on thermometer → conflict', () => {
    let board = createEmpty()
    board = placeDigit(board, 0, 0, 5, 'p1')
    const meta: BoardMetadata = { thermometers: [
      [{ row: 0, col: 0 }, { row: 0, col: 1 }]
    ]}
    const conflicts = thermometerRuleset.validate(board, meta, 0, 1, 5)
    expect(conflicts.some(c => c.row === 0 && c.col === 0)).toBe(true)
    expect(conflicts.some(c => c.row === 0 && c.col === 1)).toBe(true)
  })

  it('decreasing value → conflict', () => {
    let board = createEmpty()
    board = placeDigit(board, 0, 0, 7, 'p1')
    const meta: BoardMetadata = { thermometers: [
      [{ row: 0, col: 0 }, { row: 0, col: 1 }]
    ]}
    const conflicts = thermometerRuleset.validate(board, meta, 0, 1, 3)
    expect(conflicts.length).toBeGreaterThan(0)
  })

  it('partially filled thermometer with valid increasing values → no conflict', () => {
    let board = createEmpty()
    board = placeDigit(board, 0, 0, 2, 'p1')
    const meta: BoardMetadata = { thermometers: [
      [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]
    ]}
    const conflicts = thermometerRuleset.validate(board, meta, 0, 1, 4)
    expect(conflicts).toEqual([])
  })
})
