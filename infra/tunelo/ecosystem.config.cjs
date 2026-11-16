// PM2 ecosystem for production. Each release lives in /var/www/tunelo/releases/<id> with this file;
// infra/tunelo/activate-incoming.sh points /var/www/tunelo/current at it and runs
//   pm2 start /var/www/tunelo/current/ecosystem.config.cjs --update-env && pm2 save
// The env file stays in /var/www/tunelo, outside the releases, loaded with Node's --env-file flag.

module.exports = {
	apps: [
		{
			name: "tunelo",
			script: "server.mjs",
			cwd: "/var/www/tunelo/current",
			node_args: "--env-file=/var/www/tunelo/.env",
			instances: 1,
			exec_mode: "fork",
			autorestart: true,
			max_memory_restart: "500M",
			kill_timeout: 5000,
			env: {
				NODE_ENV: "production",
				// Only nginx reaches the HTTP port; TCP tunnel ports stay public.
				TUNNEL_HOST: "127.0.0.1",
				// IPv6 egress on the server is broken and IPv4 connects can take over 2 s, so Node's default
				// happy eyeballs (250 ms per address) times out: try IPv4 first and give each address 2.5 s.
				NODE_OPTIONS:
					"--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=2500",
			},
		},
	],
};
