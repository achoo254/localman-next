import type { TunnelListItem } from "../tunnel-directory.js";
import { gettingStarted } from "./getting-started.js";
import { type SafeHtml, html } from "./html.js";
import type { Locale } from "./i18n/locale.js";
import type { Translator } from "./i18n/messages.js";
import { type SignedInChrome, renderLayout } from "./layout.js";

export interface TunnelsPageOptions {
	readonly i18n: Translator;
	readonly account: SignedInChrome;
	readonly tunnels: readonly TunnelListItem[];
	/** IdP page where the account's devices and grants are managed. */
	readonly devicesUrl: string;
	readonly notice: string | null;
	readonly now?: Date;
}

interface MachineGroup {
	readonly name: string;
	readonly tunnels: readonly TunnelListItem[];
}

/** Tunnels per machine; machines by name, newest tunnel first. */
export function groupByMachine(
	tunnels: readonly TunnelListItem[],
): MachineGroup[] {
	const groups = new Map<string, TunnelListItem[]>();
	for (const tunnel of tunnels) {
		const list = groups.get(tunnel.deviceName) ?? [];
		list.push(tunnel);
		groups.set(tunnel.deviceName, list);
	}
	return [...groups.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, list]) => ({
			name,
			tunnels: list.sort((a, b) => b.connectedAt.localeCompare(a.connectedAt)),
		}));
}

/** "5 minutes ago" in the page language. */
export function relativeTime(locale: Locale, from: Date, now: Date): string {
	const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	const seconds = Math.round((from.getTime() - now.getTime()) / 1000);
	const elapsed = Math.abs(seconds);
	if (elapsed < 45) return format.format(0, "second");
	if (elapsed < 3600) return format.format(Math.round(seconds / 60), "minute");
	if (elapsed < 86_400)
		return format.format(Math.round(seconds / 3600), "hour");
	return format.format(Math.round(seconds / 86_400), "day");
}

function tunnelItem(
	i18n: Translator,
	tunnel: TunnelListItem,
	now: Date,
): SafeHtml {
	const key = tunnel.subdomain ?? `tcp-${tunnel.publicPort ?? "port"}`;
	const address =
		tunnel.protocol === "http"
			? html`<a class="tunnel-url" href="${tunnel.url}" target="_blank" rel="noopener noreferrer" data-id="tunnel-${key}-open">${tunnel.url}</a>`
			: html`<code class="tunnel-url" title="${i18n.t("tunnel.tcpHint")}">${tunnel.url}</code>`;
	return html`<li class="tunnel" data-id="tunnel-${key}">
<div class="tunnel-head"><span class="badge badge-${tunnel.protocol}"><span class="visually-hidden">${i18n.t("tunnel.protocol")}: </span>${tunnel.protocol.toUpperCase()}</span>${address}</div>
<dl class="tunnel-facts">
<div><dt>${i18n.t("tunnel.localPort")}</dt><dd>${tunnel.localPort ?? "—"}</dd></div>
<div><dt>${i18n.t("tunnel.basicAuth")}</dt><dd>${i18n.t(tunnel.basicAuth ? "tunnel.basicAuthOn" : "tunnel.basicAuthOff")}</dd></div>
<div><dt>${i18n.t("tunnel.connected")}</dt><dd><time datetime="${tunnel.connectedAt}">${relativeTime(i18n.locale, new Date(tunnel.connectedAt), now)}</time></dd></div>
</dl>
</li>`;
}

function machineCard(
	i18n: Translator,
	group: MachineGroup,
	now: Date,
): SafeHtml {
	return html`<section class="card machine" data-id="machine-card">
<header class="machine-head"><h2 class="machine-name">${group.name || i18n.t("tunnels.unnamedMachine")}</h2><span class="muted">${i18n.plural(group.tunnels.length, "tunnels.machineCountOne", "tunnels.machineCountOther")}</span></header>
<ul class="tunnel-list">${group.tunnels.map((tunnel) => tunnelItem(i18n, tunnel, now))}</ul>
</section>`;
}

function emptyState(i18n: Translator): SafeHtml {
	return html`<section class="card empty" data-id="tunnels-empty">
<h2 class="empty-title">${i18n.t("empty.title")}</h2>
<p>${i18n.t("empty.body")}</p>
<p>${i18n.t("empty.fix")}</p>
${gettingStarted(i18n, "h3")}
</section>`;
}

/** `/` signed in: the account's live tunnels, grouped by machine. */
export function renderTunnelsPage(options: TunnelsPageOptions): string {
	const { i18n, tunnels } = options;
	const now = options.now ?? new Date();
	const groups = groupByMachine(tunnels);
	return renderLayout({
		title: i18n.t("meta.tunnelsTitle"),
		i18n,
		account: options.account,
		notice: options.notice,
		body: html`<section class="page-head" data-id="tunnels-head">
<div>
<h1 class="page-title">${i18n.t("tunnels.title")}</h1>
<p class="muted">${i18n.plural(tunnels.length, "tunnels.countOne", "tunnels.countOther")} · ${i18n.t("tunnels.snapshot")}</p>
</div>
<a class="btn btn-secondary" href="${options.devicesUrl}" data-id="tunnels-devices">${i18n.t("tunnels.devices")}</a>
</section>
${groups.length === 0 ? emptyState(i18n) : html`<div class="machines">${groups.map((group) => machineCard(i18n, group, now))}</div>`}`,
	});
}
