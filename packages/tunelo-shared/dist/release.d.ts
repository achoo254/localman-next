/**
 * Where the Tunelo CLI is released. Each release is a GitHub release of the
 * public localman-next repository, tagged `tunelo-v<version>`, with the npm
 * package tarball attached as `tunelo.tgz`. npm and pnpm install it straight
 * from the URL; there is no registry.
 */
export declare const TUNELO_RELEASE_REPO = "achoo254/localman-next";
export declare const TUNELO_RELEASE_TAG_PREFIX = "tunelo-v";
export declare const TUNELO_RELEASE_ASSET = "tunelo.tgz";
/** Tarball of one version, or of the latest release when `version` is omitted. */
export declare function tuneloTarballUrl(version?: string): string;
/**
 * Tunelo 2.x is the `tunelo` binary of chat-next (`apps/agent`): one process
 * for tunnels and the machine, installed by these scripts the Chat web app
 * serves. The npm package (1.12) only hands commands to it.
 */
export declare const TUNELO_INSTALL_SCRIPT_URLS: {
    readonly macos: "https://chat.hoandat.com/agent/install.sh";
    readonly windows: "https://chat.hoandat.com/agent/install.ps1";
};
/** Install commands of tunelo 2.x: a terminal on macOS, PowerShell on Windows. */
export declare const TUNELO_INSTALL_COMMANDS: {
    readonly macos: "curl -fsSL https://chat.hoandat.com/agent/install.sh | sh";
    readonly windows: "& ([scriptblock]::Create((irm https://chat.hoandat.com/agent/install.ps1)))";
};
/** The install command shown where only one fits (macOS; Windows in `TUNELO_INSTALL_COMMANDS`). */
export declare const TUNELO_INSTALL_COMMAND: "curl -fsSL https://chat.hoandat.com/agent/install.sh | sh";
/** GitHub API endpoint of the latest release (its `tag_name` carries the version). */
export declare const TUNELO_LATEST_RELEASE_API = "https://api.github.com/repos/achoo254/localman-next/releases/latest";
/** Version in a `tunelo-v<semver>` tag, or null for any other tag. */
export declare function versionFromReleaseTag(tag: string): string | null;
