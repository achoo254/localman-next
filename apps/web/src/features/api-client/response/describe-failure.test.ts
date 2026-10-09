import { describe, expect, it } from "vitest";
import { en } from "../../../i18n/messages/en/dictionary";
import { vi as viMessages } from "../../../i18n/messages/vi/dictionary";
import { zhCN } from "../../../i18n/messages/zh-CN/dictionary";
import { createTranslator } from "../../../i18n/translate";
import { describeFailure } from "./describe-failure";

const BUSY = { code: "PROXY_BUSY", message: "Too many proxy requests" };

describe("describeFailure", () => {
	it("tells to wait for the running proxy requests on PROXY_BUSY", () => {
		expect(describeFailure(BUSY, createTranslator("en", en).t)).toEqual({
			title: "Too many requests through the proxy at once",
			hint: "Wait for the requests already running to finish, then send again.",
		});
	});

	it("says it in every language", () => {
		expect(describeFailure(BUSY, createTranslator("vi", viMessages).t)).toEqual(
			{
				title: "Quá nhiều request qua proxy cùng lúc",
				hint: "Chờ các request trước xong rồi gửi lại.",
			},
		);
		expect(describeFailure(BUSY, createTranslator("zh-CN", zhCN).t).title).toBe(
			"同时经 proxy 发送的 request 过多",
		);
	});

	it("keeps the API's message for a code it does not know", () => {
		const copy = describeFailure(
			{ code: "SOMETHING_NEW", message: "Odd failure" },
			createTranslator("en", en).t,
		);
		expect(copy.hint).toBe("Odd failure");
	});
});
