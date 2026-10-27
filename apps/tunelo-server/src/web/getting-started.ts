import { TUNELO_INSTALL_COMMAND } from "@tunelo/shared";
import { TUNELO_LOGIN_COMMAND } from "../tenancy/login-command.js";
import { type SafeHtml, html } from "./html.js";
import type { MessageKey, Translator } from "./i18n/messages.js";

interface Step {
	readonly title: MessageKey;
	readonly body: MessageKey;
	readonly command: () => string;
	readonly id: string;
}

const STEPS: readonly Step[] = [
	{
		id: "install",
		title: "steps.install.title",
		body: "steps.install.body",
		command: () => TUNELO_INSTALL_COMMAND,
	},
	{
		id: "login",
		title: "steps.login.title",
		body: "steps.login.body",
		command: () => TUNELO_LOGIN_COMMAND,
	},
	{
		id: "open",
		title: "steps.open.title",
		body: "steps.open.body",
		command: () => "tunelo http 3000",
	},
];

/** The three steps from install to a running tunnel. */
export function gettingStarted(
	i18n: Translator,
	headingLevel: "h2" | "h3" = "h2",
): SafeHtml {
	const heading =
		headingLevel === "h2"
			? html`<h2 class="section-title">${i18n.t("steps.title")}</h2>`
			: html`<h3 class="section-title">${i18n.t("steps.title")}</h3>`;
	return html`<section class="steps" aria-label="${i18n.t("steps.title")}" data-id="getting-started">
${heading}
<ol class="step-list">${STEPS.map(
		(step) => html`<li class="step" data-id="step-${step.id}">
<p class="step-title">${i18n.t(step.title)}</p>
<pre class="command"><code>${step.command()}</code></pre>
<p class="muted">${i18n.t(step.body)}</p>
</li>`,
	)}</ol>
</section>`;
}
