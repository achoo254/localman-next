/**
 * English, the source language. Every other dictionary must have exactly
 * these keys (a missing or extra key fails the typecheck). `{name}` marks a
 * value filled in at render time.
 */
export const en = {
	"meta.homeTitle": "Tunelo: public URLs for your local servers",
	"meta.tunnelsTitle": "Your tunnels · Tunelo",
	"nav.home": "Tunelo home",
	"nav.signIn": "Sign in",
	"nav.signOut": "Sign out",
	"nav.language": "Language",
	"nav.account": "Signed in as {name}",
	"home.eyebrow": "Tunnels for developers",
	"home.title": "Put a local server on the internet with one command",
	"home.lead":
		"Tunelo gives the app running on your machine a public HTTPS address under {domain}, or a TCP port for anything else. Sign in with your hoandat account to see every tunnel your machines have open.",
	"home.cta": "Sign in with hoandat",
	"home.ctaHint": "Google or GitHub, through auth.hoandat.com.",
	"steps.title": "Get started",
	"steps.install.title": "Install the CLI",
	"steps.install.body": "Needs Node.js 20 or later.",
	"steps.login.title": "Sign in on your machine",
	"steps.login.body":
		"Ties the tunnels of this machine to your account. Needs CLI 1.7.0 or later.",
	"steps.open.title": "Open a tunnel",
	"steps.open.body":
		"Use the port your local server listens on. The terminal prints the public URL.",
	"tunnels.title": "Your tunnels",
	"tunnels.countOne": "1 tunnel running",
	"tunnels.countOther": "{count} tunnels running",
	"tunnels.snapshot":
		"The list shows the tunnels open when this page loaded. Reload to update it.",
	"tunnels.devices": "Manage devices",
	"tunnels.machineCountOne": "1 tunnel",
	"tunnels.machineCountOther": "{count} tunnels",
	"tunnels.unnamedMachine": "Unnamed machine",
	"tunnel.protocol": "Protocol",
	"tunnel.localPort": "Local port",
	"tunnel.basicAuth": "Basic Auth",
	"tunnel.basicAuthOn": "On",
	"tunnel.basicAuthOff": "Off",
	"tunnel.connected": "Connected",
	"tunnel.tcpHint": "Connect with a TCP client",
	"empty.title": "No tunnels on this account right now",
	"empty.body":
		"Tunnels show up here while they run. Tunnels opened with Tunelo CLI 1.6.x use an anonymous key that is not tied to any account, so they are not listed here, even while they work.",
	"empty.fix":
		"On that machine, update the CLI to 1.7.0 or later, sign in, then open the tunnel again:",
	"error.login_failed": "Sign-in did not complete. Please try again.",
	"error.login_expired":
		"The sign-in took too long or was started in another tab. Please try again.",
	"error.access_denied": "Sign-in was cancelled.",
	"error.idp_unavailable":
		"The sign-in service is not reachable right now. Please try again shortly.",
	"error.csrf": "That request expired. Reload the page and try again.",
	"footer.note": "Accounts by auth.hoandat.com",
} as const;
