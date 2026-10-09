// PM2 process for Localman on server .65 (pm2 runs as root, shared with the
// other apps). Usage on the server (deploy.sh does this):
//   cd /opt/localman && pm2 startOrReload infra/ecosystem.config.cjs --update-env && pm2 save
//
// One process serves both the dashboard API (127.0.0.1:4000) and the mock
// runtime (127.0.0.1:4100). Rate limits, the monthly quota counters and the
// resolve-project cache live in process memory, so this stays one fork-mode
// instance; scaling out first needs a shared store for that state.
//
// The process runs as the `localman` user. It is started as a plain binary
// (`interpreter: "none"`): with a Node interpreter pm2 would load its own
// ProcessContainerFork.js from root's nvm tree, which `localman` cannot
// read. setup-server.sh copies root's Node to /opt/localman/runtime/node.

module.exports = {
	apps: [
		{
			name: "localman-api",
			script: "/opt/localman/runtime/node",
			interpreter: "none",
			args: [
				"--env-file=/opt/localman/.env",
				"--enable-source-maps",
				"/opt/localman/api/main.mjs",
			],
			cwd: "/opt/localman/api",
			uid: "localman",
			gid: "localman",
			exec_mode: "fork",
			instances: 1,
			autorestart: true,
			// The API exits on purpose when MongoDB or the env is missing;
			// back off instead of spinning.
			exp_backoff_restart_delay: 1000,
			max_memory_restart: "600M",
			// Above the API's own 10 s graceful shutdown (flushes usage counters).
			kill_timeout: 12000,
			out_file: "/var/log/localman/api.out.log",
			error_file: "/var/log/localman/api.err.log",
			env: {
				NODE_ENV: "production",
			},
		},
	],
};
