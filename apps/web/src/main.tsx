import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles/global.css";

const container = document.getElementById("app");
if (!container) {
	throw new Error("Missing #app mount point in index.html");
}

createRoot(container).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
