import { loadConfig } from '../lib/config.js'
import { AGENT_VERSION, createAgentServer, listen } from '../lib/server.js'

/**
 * pnpm serve [--port 9100] [--origin https://feedback.allindiacafe.in]
 *
 * The process the Windows service runs. Fails loudly at startup on bad config
 * rather than at 9pm on the first print.
 */

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`)
  const value = index === -1 ? undefined : process.argv[index + 1]
  return value ?? fallback
}

const port = Number(arg('port', '9100'))
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error(`--port must be an integer 1024-65535, got ${arg('port', '9100')}`)
  process.exit(1)
}

// No default: an agent that guesses the origin defeats the CORS check.
const origin = arg('origin', '')
if (origin === '') {
  console.error('--origin is required, e.g. --origin https://feedback.allindiacafe.in')
  process.exit(1)
}

const config = await loadConfig()
const server = createAgentServer({ config, allowedOrigin: origin })

await listen(server, port)

console.log(
  JSON.stringify({
    at: new Date().toISOString(),
    event: 'listening',
    version: AGENT_VERSION,
    host: '127.0.0.1',
    port,
    origin,
    share: config.print.share === '' ? '(none — prints will fail)' : config.print.share,
  }),
)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
