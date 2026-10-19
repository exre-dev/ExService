const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const plan = JSON.parse(process.env.EXWEBSITE_RUNTIME_LAUNCH_PLAN || '{}')
// Each wrapper receives only its consumer environment from the validated root adapter.
module.exports = {
  apps: ['server', 'hydra'].map((service) => ({
    name: `exwebsite-${service}`,
    script: path.join(root, 'scripts/runtime/pm2-process.mjs'),
    args: [service],
    cwd: root,
    interpreter: process.execPath,
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    filter_env: ['EXWEBSITE_RUNTIME_LAUNCH_PLAN'],
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      SystemRoot: process.env.SystemRoot,
      EXWEBSITE_RUNTIME_PROCESS: JSON.stringify(plan[service]),
    },
    out_file: process.platform === 'win32' ? 'NULL' : '/dev/null',
    error_file: process.platform === 'win32' ? 'NULL' : '/dev/null',
    kill_timeout: 10000,
    max_restarts: 5,
    min_uptime: 5000,
    restart_delay: 1000,
    vizion: false,
  })),
}
