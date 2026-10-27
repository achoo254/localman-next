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

/** The install command shown to users. */
export const TUNELO_INSTALL_COMMAND = `npm install -g ${tuneloTarballUrl()}`;

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
