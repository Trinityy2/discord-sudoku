import 'dotenv/config'
export const config = {
  port: Number(process.env.PORT ?? 3000),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID ?? '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
  },
  isDev: process.env.NODE_ENV !== 'production',
}
