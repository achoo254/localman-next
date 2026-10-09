/**
 * Ready-made lines for the Scripts tab, using the sandbox's `lm` API. The
 * code is never translated; only the label is (`apiClient.scripts.snippets`).
 */
export const SCRIPT_SNIPPETS = [
	{ id: "setVariable", code: 'lm.variables.set("key", "value");' },
	{ id: "getVariable", code: 'lm.variables.get("key");' },
	{ id: "setEnvironment", code: 'lm.environment.set("key", "value");' },
	{ id: "unsetEnvironment", code: 'lm.environment.unset("key");' },
	{
		id: "statusIs200",
		code: 'lm.test("Status is 200", () => {\n\tlm.expect(lm.response.status).to.equal(200);\n});',
	},
	{
		id: "saveToken",
		code: 'lm.environment.set("token", lm.response.json().token);',
	},
	{ id: "log", code: "console.log(lm.request.url);" },
] as const;

export type ScriptSnippetId = (typeof SCRIPT_SNIPPETS)[number]["id"];

/** `script` with `code` on a new last line. */
export function appendSnippet(script: string, code: string): string {
	if (!script) return `${code}\n`;
	return `${script}${script.endsWith("\n") ? "" : "\n"}${code}\n`;
}
