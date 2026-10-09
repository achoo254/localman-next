import { createContext, useContext } from "react";
import { type FeatureFlags, parseFeatureFlags } from "./feature-flags";

export {
	type FeatureFlags,
	type FeatureName,
	NO_FEATURES,
	parseFeatureFlags,
} from "./feature-flags";

/** Flags of this build (see feature-flags.ts). */
export const features: FeatureFlags = parseFeatureFlags(
	import.meta.env.VITE_FEATURES,
);

/**
 * Flags seen by components. Defaults to the build flags; tests (and
 * previews) render under `<FeaturesContext value={…}>` to try other sets.
 */
export const FeaturesContext = createContext<FeatureFlags>(features);

export function useFeatures(): FeatureFlags {
	return useContext(FeaturesContext);
}
