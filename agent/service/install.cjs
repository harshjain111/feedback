/**
 * Install the print agent as a Windows service.
 *
 *   node service/install.cjs --origin https://feedback.allindiacafe.in
 *
 * A service rather than a shortcut in Startup, because the kiosk reboots
 * unattended: nobody is going to notice a missing tray icon at 11am on a
 * Saturday, and a guest would just get a journey that quietly skips the photo.
 * node-windows wraps it in winsw, which restarts the process if it dies.
 *
 * CommonJS on purpose — node-windows is CJS and this runs once, by hand, on the
 * kiosk. It is not part of the agent's runtime.
 */
const path = require('node:path')

if (process.platform !== 'win32') {
  console.error('This installs a Windows service and only runs on Windows.')
  process.exit(1)
}

const originIndex = process.argv.indexOf('--origin')
const origin = originIndex === -1 ? undefined : process.argv[originIndex + 1]
if (!origin) {
  console.error('--origin is required, e.g. --origin https://feedback.allindiacafe.in')
  console.error('It must match the kiosk URL exactly; the agent refuses every other origin.')
  process.exit(1)
}

let Service
try {
  ;({ Service } = require('node-windows'))
} catch {
  console.error('node-windows is not installed. Run:  pnpm add -D node-windows')
  process.exit(1)
}

const service = new Service({
  name: 'AIC Memory Print Agent',
  description:
    'Renders and prints keepsake photos on the kiosk thermal printer. Listens on 127.0.0.1 only.',
  // The service runs the compiled entry through tsx. Node 20+ could strip types
  // natively, but tsx is already a dependency and behaves the same on every
  // patch release.
  script: path.join(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  scriptOptions: `${path.join(__dirname, '..', 'cli', 'serve.ts')} --origin ${origin}`,
  workingDirectory: path.join(__dirname, '..'),
  env: [{ name: 'NODE_ENV', value: 'production' }],
  // Restart on crash, but back off: a printer that is genuinely broken should
  // not spin the CPU retrying every second all night.
  wait: 2,
  grow: 0.5,
  maxRestarts: 10,
})

service.on('install', () => {
  console.log('installed. starting…')
  service.start()
})
service.on('start', () => console.log('AIC Memory Print Agent is running on 127.0.0.1:9100'))
service.on('alreadyinstalled', () => console.log('already installed; nothing to do'))
service.on('error', (error) => console.error('service error:', error))

service.install()
