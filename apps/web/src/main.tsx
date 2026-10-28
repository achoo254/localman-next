import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./app";
import { loadInitialLocale } from "./i18n/i18n-provider";
import { watchSharedTheme } from "./lib/shared-preferences";
import { loadMobileSession } from "./platform/native/mobile-session";
import { isNativeBuild } from "./platform/native/native-build";
import "./styles/global.css";

// The head script set the theme before first paint; from now on follow it.
watchSharedTheme();

const container = document.getElementById("app");
if (!container) {
	throw new Error("Missing #app mount point in index.html");
}

// The build prerenders the public landing into #app; an inline
// script in index.html empties it on any path the markup does not belong
// to. Markup left here is this page (in English), so hydrate it instead of
// painting it a second time; the provider then switches to the visitor's
// language. Any other page waits for its language first so it paints once,
// in that language.
if (isNativeBuild) {
	// The shell renders once its stored session is loaded, so the first
	// request is already signed (platform/native/mobile-session.ts).
	container.replaceChildren();
	void Promise.all([loadInitialLocale(), loadMobileSession()]).then(
		([i18n]) => {
			createRoot(container).render(<App i18n={i18n} />);
		},
	);
} else if (container.firstElementChild) {
	hydrateRoot(container, <App />);
} else {
	void loadInitialLocale().then((i18n) => {
		createRoot(container).render(<App i18n={i18n} />);
	});
}
