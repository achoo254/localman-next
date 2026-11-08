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
/** The install command shown to users. */
export declare const TUNELO_INSTALL_COMMAND: string;
/** GitHub API endpoint of the latest release (its `tag_name` carries the version). */
export declare const TUNELO_LATEST_RELEASE_API = "https://api.github.com/repos/achoo254/localman-next/releases/latest";
/** Version in a `tunelo-v<semver>` tag, or null for any other tag. */
export declare function versionFromReleaseTag(tag: string): string | null;
