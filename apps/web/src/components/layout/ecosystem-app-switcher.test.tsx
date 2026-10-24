import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nContext } from "../../i18n/i18n-context";
import { en } from "../../i18n/messages/en/dictionary";
import { createTranslator } from "../../i18n/translate";
import { DEFAULT_TENANT_INFO, type TenantInfo } from "../../lib/tenant-info";
import {
	EcosystemAppSwitcher,
	tenantDomainOfIdp,
} from "./ecosystem-app-switcher";

const state = vi.hoisted(() => ({
	native: false,
	idpOrigin: "https://auth.hoandat.com",
}));

vi.mock("../../platform/native/native-build", () => ({
	get isNativeBuild() {
		return state.native;
	},
}));

vi.mock("../../lib/tenant-info", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../lib/tenant-info")>();
	return {
		...actual,
		useTenantInfo: (): TenantInfo => ({
			...actual.DEFAULT_TENANT_INFO,
			idpOrigin: state.idpOrigin,
		}),
	};
});

const UTM = "utm_source=localman&utm_medium=app_switcher";

function renderSwitcher(locale: "en" | "vi" = "en") {
	const value = {
		...createTranslator(locale, en),
		setLocale: () => Promise.resolve(),
	};
	return render(
		<I18nContext value={value}>
			<EcosystemAppSwitcher />
		</I18nContext>,
	);
}

async function openPanel(name = "Switch app") {
	await userEvent.click(screen.getByRole("button", { name }));
	return screen.getByRole("dialog");
}

describe("tenantDomainOfIdp", () => {
	it.each([
		["https://auth.hoandat.com", "hoandat.com"],
		["https://auth.acme.example", "acme.example"],
		["http://localhost:4000", null],
		["https://idp.acme.example", null],
		["not a url", null],
	])("reads %s as %s", (origin, domain) => {
		expect(tenantDomainOfIdp(origin)).toBe(domain);
	});
});

describe("EcosystemAppSwitcher", () => {
	afterEach(() => {
		state.native = false;
		state.idpOrigin = DEFAULT_TENANT_INFO.idpOrigin;
		vi.restoreAllMocks();
	});

	it("lists the other apps of the primary tenant, not this one", async () => {
		renderSwitcher();
		const panel = await openPanel();
		const links = within(panel).getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			`https://chat.hoandat.com/?${UTM}`,
			`https://scribe.hoandat.com/?${UTM}`,
			`https://tunnel.hoandat.com/?${UTM}`,
			`https://auth.hoandat.com/account?${UTM}`,
		]);
	});

	it("leaves Scribe out on another tenant's domain", async () => {
		state.idpOrigin = "https://auth.acme.example";
		renderSwitcher();
		const panel = await openPanel();
		expect(
			within(panel)
				.getAllByRole("link")
				.map((link) => new URL(link.getAttribute("href") ?? "").host),
		).toEqual([
			"chat.acme.example",
			"tunnel.acme.example",
			"auth.acme.example",
		]);
	});

	it("speaks the app's language", async () => {
		renderSwitcher("vi");
		expect(
			screen.getByRole("button", { name: "Chuyển ứng dụng" }),
		).toBeVisible();
	});

	it("renders nothing when the IdP is not on auth.<domain>", () => {
		state.idpOrigin = "http://localhost:4000";
		const { container } = renderSwitcher();
		expect(container).toBeEmptyDOMElement();
	});

	it("opens a link in the system browser from the native shell", async () => {
		state.native = true;
		const open = vi.spyOn(window, "open").mockReturnValue(null);
		renderSwitcher();
		const panel = await openPanel();
		await userEvent.click(within(panel).getAllByRole("link")[0] as Element);
		expect(open).toHaveBeenCalledWith(
			`https://chat.hoandat.com/?${UTM}`,
			"_blank",
			"noopener,noreferrer",
		);
	});
});
