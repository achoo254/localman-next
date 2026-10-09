/**
 * Feature flags for copy that must not advertise unreleased features. A
 * flag turns on only when its feature runs in production: `apiClient`
 * (API client, proxy and Tunelo), `liveMockSync`, `mockMcp`, `directMode`
 * (requests sent straight from the browser), `hybridMock` and
 * `mockPowerUps` (resource import, type export, chaos, conditional rules
 * and Faker suggestions).
 *
 * Set at build time in `VITE_FEATURES`, a comma-separated list such as
 * `apiClient,mockMcp`. Everything is off by default. No React here:
 * `vite.config.ts` parses the variable too, so a typo fails the build.
 */
export interface FeatureFlags {
	readonly apiClient: boolean;
	readonly liveMockSync: boolean;
	readonly mockMcp: boolean;
	readonly directMode: boolean;
	readonly hybridMock: boolean;
	readonly mockPowerUps: boolean;
}

export type FeatureName = keyof FeatureFlags;

export const NO_FEATURES: FeatureFlags = Object.freeze({
	apiClient: false,
	liveMockSync: false,
	mockMcp: false,
	directMode: false,
	hybridMock: false,
	mockPowerUps: false,
});

function isFeatureName(value: string): value is FeatureName {
	return Object.hasOwn(NO_FEATURES, value);
}

/** Parses `VITE_FEATURES`; an unknown name throws. */
export function parseFeatureFlags(raw: string | undefined): FeatureFlags {
	const flags: Record<FeatureName, boolean> = { ...NO_FEATURES };
	for (const part of (raw ?? "").split(",")) {
		const name = part.trim();
		if (name === "") continue;
		if (!isFeatureName(name)) {
			throw new Error(`VITE_FEATURES has an unknown feature "${name}"`);
		}
		flags[name] = true;
	}
	return Object.freeze(flags);
}
