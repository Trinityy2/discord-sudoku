export interface DiscordUser {
  id: string
  username: string
  avatar: string
}

export type TokenVerifier = (accessToken: string) => Promise<DiscordUser>

export const verifyDiscordToken: TokenVerifier = async (accessToken) => {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Invalid Discord token')
  const data = (await res.json()) as { id: string; username: string; avatar: string | null }
  return { id: data.id, username: data.username, avatar: data.avatar ?? '' }
}
