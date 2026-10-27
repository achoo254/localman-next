import { describe, expect, it } from "vitest";
import {
	TUNELO_INSTALL_COMMAND,
	tuneloTarballUrl,
	versionFromReleaseTag,
} from "../release.js";

describe("tuneloTarballUrl", () => {
	it("points at the tarball of one release", () => {
		expect(tuneloTarballUrl("1.10.0")).toBe(
			"https://github.com/achoo254/localman-next/releases/download/tunelo-v1.10.0/tunelo.tgz",
		);
	});

	it("points at the latest release without a version", () => {
		expect(tuneloTarballUrl()).toBe(
			"https://github.com/achoo254/localman-next/releases/latest/download/tunelo.tgz",
		);
		expect(TUNELO_INSTALL_COMMAND).toBe(`npm install -g ${tuneloTarballUrl()}`);
	});
});

describe("versionFromReleaseTag", () => {
	it("reads the version of a tunelo tag", () => {
		expect(versionFromReleaseTag("tunelo-v1.10.0")).toBe("1.10.0");
	});

	it("rejects other tags", () => {
		expect(versionFromReleaseTag("v1.10.0")).toBeNull();
		expect(versionFromReleaseTag("tunelo-v")).toBeNull();
	});

	it("rejects anything but plain semver, since the version reaches a shell", () => {
		expect(versionFromReleaseTag("tunelo-v1.2.3-beta.1")).toBe("1.2.3-beta.1");
		expect(versionFromReleaseTag("tunelo-v1.2.3 && calc")).toBeNull();
		expect(versionFromReleaseTag("tunelo-v1.2")).toBeNull();
	});
});
