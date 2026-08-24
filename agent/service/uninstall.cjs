/** Remove the Windows service.  node service/uninstall.cjs */
const path = require('node:path')

if (process.platform !== 'win32') {
  console.error('This removes a Windows service and only runs on Windows.')
  process.exit(1)
}

let Service
try {
  ;({ Service } = require('node-windows'))
} catch {
  console.error('node-windows is not installed; nothing to remove.')
  process.exit(1)
}

const service = new Service({
  name: 'AIC Memory Print Agent',
  script: path.join(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
})

service.on('uninstall', () => console.log('uninstalled'))
service.on('doesnotexist', () => console.log('was not installed'))
service.uninstall()
