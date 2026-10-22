import type { CapacitorConfig } from "@capacitor/cli";
// appId and appName come from brand.config.json through `pnpm brand:gen`.
import brand from "../../packages/brand/generated/capacitor.json" with {
	type: "json",
};

/**
 * iOS/Android shell around the full web app, built with `VITE_NATIVE=true`
 * into apps/web/dist-native (scripts/build-native-web.sh). The page runs at
 * capacitor://localhost (iOS) or https://localhost (Android) and calls the
 * Localman API on its public host with a Bearer session; sign-in goes
 * through the system browser (docs/decisions/0005-mobile-session-handoff.md).
 */
const config: CapacitorConfig = {
	appId: brand.appId,
	appName: brand.appName,
	webDir: "../web/dist-native",
};

export default config;
