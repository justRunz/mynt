import { createApp } from './app.js'
import { env } from './env.js'

createApp().listen(env.port, env.host, () => {
  console.log(`API sur http://${env.host}:${env.port}`)
})
