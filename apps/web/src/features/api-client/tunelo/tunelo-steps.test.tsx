import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../../i18n/i18n-provider";
import { vi as viMessages } from "../../../i18n/messages/vi/dictionary";
import { TuneloSteps } from "./tunelo-steps";

describe("TuneloSteps", () => {
	it("writes the port as typed, without locale digit grouping", () => {
		const { container } = render(
			<I18nProvider initial={{ locale: "vi", messages: viMessages }}>
				<TuneloSteps port={8003} />
			</I18nProvider>,
		);
		const text = container.textContent ?? "";
		expect(text).toContain("tunelo http 8003");
		expect(text).toContain("tunelo tcp 8003");
		expect(text).not.toContain("8.003");
	});
});
