import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../../test/axe";
import type { SecretAsk } from "./route-types";
import { renderClient, stubCanvas } from "./routing-test-utils";
import { SecretConsentModal } from "./secret-consent-modal";

const ASK: SecretAsk = {
	host: "api.test",
	url: "https://api.test",
	target: "api.test",
	parts: ["Authorization", "{{token}}"],
	route: "proxy",
	why: "cors",
};

afterEach(() => vi.restoreAllMocks());

describe("SecretConsentModal", () => {
	it("names the host and credentials, never sends without a click", async () => {
		stubCanvas();
		const onAnswer = vi.fn();
		renderClient(<SecretConsentModal ask={ASK} onAnswer={onAnswer} />);
		const dialog = screen.getByRole("dialog", {
			name: "Send through the proxy?",
		});
		expect(dialog).toHaveTextContent(
			"api.test can't be reached straight from the browser: the direct send failed (usually CORS). The request carries Authorization, {{token}}.",
		);
		expect(dialog).toHaveTextContent("The proxy will call https://api.test");
		expect(dialog).toHaveTextContent("not stored, not logged");
		expect(onAnswer).not.toHaveBeenCalled();
		expect(await seriousViolations(dialog)).toEqual([]);
	});

	it("sends once, or remembers the host when asked to", async () => {
		const user = userEvent.setup();
		const onAnswer = vi.fn();
		const { rerender } = renderClient(
			<SecretConsentModal ask={ASK} onAnswer={onAnswer} />,
		);
		await user.click(
			screen.getByRole("button", { name: "Send through proxy" }),
		);
		expect(onAnswer).toHaveBeenLastCalledWith({ send: true, remember: false });

		rerender(<SecretConsentModal ask={{ ...ASK }} onAnswer={onAnswer} />);
		await user.click(
			screen.getByRole("checkbox", { name: "Don't ask again for api.test" }),
		);
		await user.click(
			screen.getByRole("button", { name: "Send through proxy" }),
		);
		expect(onAnswer).toHaveBeenLastCalledWith({ send: true, remember: true });
	});

	it("declines on Cancel and Escape", async () => {
		const user = userEvent.setup();
		const onAnswer = vi.fn();
		renderClient(<SecretConsentModal ask={ASK} onAnswer={onAnswer} />);
		await user.click(
			screen.getByRole("checkbox", { name: "Don't ask again for api.test" }),
		);
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onAnswer).toHaveBeenLastCalledWith({ send: false, remember: false });
		await user.keyboard("{Escape}");
		expect(onAnswer).toHaveBeenCalledTimes(2);
		expect(onAnswer).toHaveBeenLastCalledWith({ send: false, remember: false });
	});

	it("shows the tunnel the proxy calls and remembers its host, not the local key", () => {
		const onAnswer = vi.fn();
		const tunnel: SecretAsk = {
			host: "demo.tunnel.hoandat.com",
			url: "https://demo.tunnel.hoandat.com",
			target: "localhost:3000",
			parts: ["Cookie"],
			route: "tunelo",
			why: "cors",
		};
		renderClient(<SecretConsentModal ask={tunnel} onAnswer={onAnswer} />);
		const dialog = screen.getByRole("dialog");
		expect(dialog).toHaveTextContent("localhost:3000 can't be reached");
		expect(dialog).toHaveTextContent(
			"The proxy will call https://demo.tunnel.hoandat.com",
		);
		expect(
			screen.getByRole("checkbox", {
				name: "Don't ask again for demo.tunnel.hoandat.com",
			}),
		).toBeInTheDocument();
	});

	it("names the default route when Proxy was not chosen on the tab", () => {
		renderClient(
			<SecretConsentModal ask={{ ...ASK, why: "manual" }} onAnswer={vi.fn()} />,
		);
		expect(screen.getByRole("dialog")).toHaveTextContent(
			"new requests use the Proxy route (Routing settings)",
		);
	});

	it("starts unticked for the next question when one was dropped unanswered", async () => {
		const user = userEvent.setup();
		const onAnswer = vi.fn();
		const { rerender } = renderClient(
			<SecretConsentModal ask={ASK} onAnswer={onAnswer} />,
		);
		await user.click(
			screen.getByRole("checkbox", { name: "Don't ask again for api.test" }),
		);
		// The tab closed: the question goes away without an answer.
		rerender(<SecretConsentModal ask={null} onAnswer={onAnswer} />);
		const next = { ...ASK, host: "other.test", url: "https://other.test" };
		rerender(<SecretConsentModal ask={next} onAnswer={onAnswer} />);
		expect(
			await screen.findByRole("checkbox", {
				name: "Don't ask again for other.test",
			}),
		).not.toBeChecked();
		expect(onAnswer).not.toHaveBeenCalled();
	});
});
