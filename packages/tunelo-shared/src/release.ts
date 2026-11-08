/**
 * Where the Tunelo CLI is released. Each release is a GitHub release of the
 * public localman-next repository, tagged `tunelo-v<version>`, with the npm
 * package tarball attached as `tunelo.tgz`. npm and pnpm install it straight
 * from the URL; there is no registry.
 */

export const TUNELO_RELEASE_REPO = "achoo254/localman-next";
export const TUNELO_RELEASE_TAG_PREFIX = "tunelo-v";
export const TUNELO_RELEASE_ASSET = "tunelo.tgz";

/** Tarball of one version, or of the latest release when `version` is omitted. */
export function tuneloTarballUrl(version?: string): string {
	const base = `https://github.com/${TUNELO_RELEASE_REPO}/releases`;
	return version
		? `${base}/download/${TUNELO_RELEASE_TAG_PREFIX}${version}/${TUNELO_RELEASE_ASSET}`
		: `${base}/latest/download/${TUNELO_RELEASE_ASSET}`;
}

/**
 * Tunelo 2.x is the `tunelo` binary of chat-next (`apps/agent`): one process
 * for tunnels and the machine, installed by these scripts the Chat web app
 * serves. The npm package (1.12) only hands commands to it.
 */
export const TUNELO_INSTALL_SCRIPT_URLS = {
	macos: "https://chat.hoandat.com/agent/install.sh",
	windows: "https://chat.hoandat.com/agent/install.ps1",
} as const;

/** Install commands of tunelo 2.x: a terminal on macOS, PowerShell on Windows. */
export const TUNELO_INSTALL_COMMANDS = {
	macos: `curl -fsSL ${TUNELO_INSTALL_SCRIPT_URLS.macos} | sh`,
	windows: `& ([scriptblock]::Create((irm ${TUNELO_INSTALL_SCRIPT_URLS.windows})))`,
} as const;

/** The install command shown where only one fits (macOS; Windows in `TUNELO_INSTALL_COMMANDS`). */
export const TUNELO_INSTALL_COMMAND = TUNELO_INSTALL_COMMANDS.macos;

/** GitHub API endpoint of the latest release (its `tag_name` carries the version). */
export const TUNELO_LATEST_RELEASE_API = `https://api.github.com/repos/${TUNELO_RELEASE_REPO}/releases/latest`;

/** Plain semver: the version ends up in an install command run through a shell on Windows. */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/;

/** Version in a `tunelo-v<semver>` tag, or null for any other tag. */
export function versionFromReleaseTag(tag: string): string | null {
	if (!tag.startsWith(TUNELO_RELEASE_TAG_PREFIX)) return null;
	const version = tag.slice(TUNELO_RELEASE_TAG_PREFIX.length);
	return VERSION_PATTERN.test(version) ? version : null;
}
