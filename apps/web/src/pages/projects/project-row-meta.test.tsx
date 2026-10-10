import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nContext, type I18nValue } from "../../i18n/i18n-context";
import type { Messages } from "../../i18n/message-types";
import { en } from "../../i18n/messages/en/dictionary";
import { vi as viMessages } from "../../i18n/messages/vi/dictionary";
import { zhCN } from "../../i18n/messages/zh-CN/dictionary";
import { createTranslator } from "../../i18n/translate";
import { seriousViolations } from "../../test/axe";
import { makeProject } from "../../test/fixtures";
import { ProjectRow } from "./project-row";
import { type Project, parseProject } from "./projects-api";

function i18nOf(locale: "en" | "vi" | "zh-CN", messages: Messages): I18nValue {
	return {
		...createTranslator(locale, messages),
		setLocale: () => Promise.resolve(),
	};
}

function renderRow(project: Project, i18n: I18nValue = i18nOf("en", en)) {
	return render(
		<I18nContext value={i18n}>
			<MemoryRouter>
				<ul>
					<ProjectRow project={project} onAction={vi.fn()} />
				</ul>
			</MemoryRouter>
		</I18nContext>,
	);
}

const meta = (id: string) =>
	document.querySelector(`[data-id="project-row-${id}-meta"]`);

describe("project row meta line", () => {
	afterEach(() => vi.restoreAllMocks());

	it("counts resources and records with plurals and grouped numbers", async () => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
		const { container } = renderRow(
			makeProject("p1", { counts: { resources: 16, records: 12400 } }),
		);
		expect(meta("p1")).toHaveTextContent("16 resources · 12,400 records");
		expect(await seriousViolations(container)).toEqual([]);
	});

	it("uses the singular for one", () => {
		renderRow(makeProject("p1", { counts: { resources: 1, records: 1 } }));
		expect(meta("p1")).toHaveTextContent("1 resource · 1 record");
	});

	it("reads naturally in Vietnamese and Chinese", () => {
		const project = makeProject("p1", {
			counts: { resources: 3, records: 1200 },
		});
		const { unmount } = renderRow(project, i18nOf("vi", viMessages));
		expect(meta("p1")).toHaveTextContent("3 resource · 1.200 bản ghi");
		unmount();
		renderRow(project, i18nOf("zh-CN", zhCN));
		expect(meta("p1")).toHaveTextContent("3 个 resource · 1,200 条记录");
	});

	it("is hidden when the API sent no counts", () => {
		renderRow(makeProject("p1"));
		expect(meta("p1")).toBeNull();
		expect(screen.getByRole("link")).toBeInTheDocument();
	});
});

describe("parseProject counts", () => {
	const json = (extra: Record<string, unknown>) => ({
		...makeProject("p1"),
		...extra,
	});

	it("reads both counts", () => {
		expect(
			parseProject(json({ resourceCount: 2, recordCount: 50 })).counts,
		).toEqual({ resources: 2, records: 50 });
	});

	it("drops missing or malformed counts instead of failing", () => {
		expect(parseProject(json({})).counts).toBeUndefined();
		expect(parseProject(json({ resourceCount: 2 })).counts).toBeUndefined();
		expect(
			parseProject(json({ resourceCount: "2", recordCount: 1 })).counts,
		).toBeUndefined();
		expect(
			parseProject(json({ resourceCount: -1, recordCount: 1 })).counts,
		).toBeUndefined();
	});
});
