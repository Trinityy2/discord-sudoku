export const PLAYER_COLOURS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63']

export function assignColour(index: number): string {
  return PLAYER_COLOURS[index % PLAYER_COLOURS.length]
}

export interface Player {
  id: string
  username: string
  avatar: string
  colour: string
  socketId: string
  isHost: boolean
}
