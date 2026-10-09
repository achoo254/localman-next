import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./app";
import "./styles/global.css";

const container = document.getElementById("app");
if (!container) {
	throw new Error("Missing #app mount point in index.html");
}

// The build prerenders the landing into #app; an inline script in
// index.html empties it on every other path. Markup left here is the
// landing, so hydrate it instead of painting it a second time.
if (container.firstElementChild) {
	hydrateRoot(container, <App />);
} else {
	createRoot(container).render(<App />);
}
