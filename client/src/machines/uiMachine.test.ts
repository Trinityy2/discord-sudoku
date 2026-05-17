import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { uiMachine } from './uiMachine'

describe('uiMachine', () => {
  it('initial state is CONNECTING', () => {
    const actor = createActor(uiMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('CONNECTING')
  })

  it('SOCKET_CONNECTED → LOBBY', () => {
    const actor = createActor(uiMachine)
    actor.start()
    actor.send({ type: 'SOCKET_CONNECTED' })
    expect(actor.getSnapshot().value).toBe('LOBBY')
  })

  it('PHASE_CHANGED { phase: "SETUP" } → SETUP', () => {
    const actor = createActor(uiMachine)
    actor.start()
    actor.send({ type: 'SOCKET_CONNECTED' })
    actor.send({ type: 'PHASE_CHANGED', phase: 'SETUP' })
    expect(actor.getSnapshot().value).toBe('SETUP')
  })

  it('PHASE_CHANGED { phase: "PLAYING" } → PLAYING', () => {
    const actor = createActor(uiMachine)
    actor.start()
    actor.send({ type: 'SOCKET_CONNECTED' })
    actor.send({ type: 'PHASE_CHANGED', phase: 'SETUP' })
    actor.send({ type: 'PHASE_CHANGED', phase: 'PLAYING' })
    expect(actor.getSnapshot().value).toBe('PLAYING')
  })

  it('PHASE_CHANGED { phase: "COMPLETED" } → COMPLETED', () => {
    const actor = createActor(uiMachine)
    actor.start()
    actor.send({ type: 'SOCKET_CONNECTED' })
    actor.send({ type: 'PHASE_CHANGED', phase: 'SETUP' })
    actor.send({ type: 'PHASE_CHANGED', phase: 'PLAYING' })
    actor.send({ type: 'PHASE_CHANGED', phase: 'COMPLETED' })
    expect(actor.getSnapshot().value).toBe('COMPLETED')
  })

  it('PHASE_CHANGED { phase: "SETUP" } from COMPLETED → SETUP', () => {
    const actor = createActor(uiMachine)
    actor.start()
    actor.send({ type: 'SOCKET_CONNECTED' })
    actor.send({ type: 'PHASE_CHANGED', phase: 'SETUP' })
    actor.send({ type: 'PHASE_CHANGED', phase: 'PLAYING' })
    actor.send({ type: 'PHASE_CHANGED', phase: 'COMPLETED' })
    actor.send({ type: 'PHASE_CHANGED', phase: 'SETUP' })
    expect(actor.getSnapshot().value).toBe('SETUP')
  })
})
