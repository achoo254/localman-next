/**
 * Source evaluated in a fresh QuickJS context before the user script. It
 * builds the whole `lm` API (globals, collection variables, environment,
 * variables, request, response, tests, expect)
 * and `console` inside the VM, so the host never exposes a callback and
 * never holds a VM function across calls. The host only passes JSON in and
 * reads one JSON string back from the returned `finish` function.
 *
 * Shape: `(function (inputJson, bodyText) { ...; return finish; })`.
 */
import { SCRIPT_EXPECT_SOURCE } from "./script-expect.js";
import {
	MAX_SCRIPT_LOG_ENTRIES,
	MAX_SCRIPT_LOG_LENGTH,
	MAX_SCRIPT_MESSAGE_LENGTH,
	MAX_SCRIPT_SCOPE_KEY_LENGTH,
	MAX_SCRIPT_SCOPE_VALUE_LENGTH,
	MAX_SCRIPT_SCOPE_VARIABLES,
	MAX_SCRIPT_TESTS,
	MAX_SCRIPT_VARIABLES,
	MAX_SCRIPT_VARIABLE_LENGTH,
} from "./script-types.js";

/** File names QuickJS puts in stack traces; the runner reads lines of the second. */
export const PRELUDE_FILE_NAME = "lm-prelude.js";
export const SCRIPT_FILE_NAME = "script.js";

export const SCRIPT_PRELUDE_SOURCE = String.raw`(function (inputJson, bodyText) {
"use strict";
const input = JSON.parse(inputJson);
const stringify = JSON.stringify;
const LOG_MAX = ${MAX_SCRIPT_LOG_ENTRIES};
const LOG_LENGTH = ${MAX_SCRIPT_LOG_LENGTH};
const MESSAGE_MAX = ${MAX_SCRIPT_MESSAGE_LENGTH};
const TEST_MAX = ${MAX_SCRIPT_TESTS};
// lm.variables lives for one send; saved scopes take the local value caps.
const SEND_LIMITS = { max: ${MAX_SCRIPT_VARIABLES}, length: ${MAX_SCRIPT_VARIABLE_LENGTH}, key: 0 };
const SCOPE_LIMITS = { max: ${MAX_SCRIPT_SCOPE_VARIABLES}, length: ${MAX_SCRIPT_SCOPE_VALUE_LENGTH}, key: ${MAX_SCRIPT_SCOPE_KEY_LENGTH} };

const str = (value) => {
	if (typeof value === "string") return value;
	try {
		const text = stringify(value);
		return text === undefined ? String(value) : text;
	} catch (e) {
		try { return String(value); } catch (e2) { return "[unprintable]"; }
	}
};
const cut = (text, max) => (text.length > max ? text.slice(0, max) : text);
const message = (error) =>
	cut(error instanceof Error ? error.name + ": " + error.message : "Uncaught " + str(error), MESSAGE_MAX);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const copy = (source) => {
	const target = Object.create(null);
	for (const key of Object.keys(source)) target[key] = source[key];
	return target;
};

const logs = [];
let logsTruncated = false;
const record = (level) => (...args) => {
	if (logs.length >= LOG_MAX) { logsTruncated = true; return; }
	const text = args.map((arg) => str(arg)).join(" ");
	if (text.length > LOG_LENGTH) logsTruncated = true;
	logs.push({ level, message: cut(text, LOG_LENGTH) });
};

// below: the scopes a read falls back to, highest first (lm.variables only).
const store = (values, label, below, limits) => Object.freeze({
	get: (key) => {
		const name = String(key);
		if (own(values, name)) return values[name];
		const from = below.find((scope) => own(scope, name));
		return from ? from[name] : undefined;
	},
	has: (key) => own(values, String(key)) || below.some((scope) => own(scope, String(key))),
	set: (key, value) => {
		const name = String(key);
		if (!name.trim()) throw new TypeError(label + ".set: the name is empty");
		if (limits.key && name.length > limits.key) throw new RangeError(label + ".set: name longer than " + limits.key + " characters");
		if (limits.key && name !== name.trim()) throw new TypeError(label + ".set: the name starts or ends with a space");
		const text = str(value);
		if (text.length > limits.length) throw new RangeError(label + ".set: value longer than " + limits.length + " characters");
		if (!own(values, name) && Object.keys(values).length >= limits.max) throw new RangeError(label + ": more than " + limits.max + " variables");
		values[name] = text;
	},
	unset: (key) => { delete values[String(key)]; },
	clear: () => { for (const key of Object.keys(values)) delete values[key]; },
	// A null-prototype target keeps a "__proto__" name as data.
	toObject: () => Object.assign(Object.create(null), ...below.slice().reverse(), values),
});
const globalValues = copy(input.globals);
const collectionValues = copy(input.collectionVariables);
const envValues = copy(input.environment);
const varValues = copy(input.variables);
const globals = store(globalValues, "lm.globals", [], SCOPE_LIMITS);
const collectionVariables = store(collectionValues, "lm.collectionVariables", [], SCOPE_LIMITS);
const environment = store(envValues, "lm.environment", [], SCOPE_LIMITS);
// Postman's order: a script value, then environment, collection, globals.
const variables = store(varValues, "lm.variables", [envValues, collectionValues, globalValues], SEND_LIMITS);

const headerOf = (list, name) => {
	const lower = String(name).toLowerCase();
	const found = list.find((h) => h !== null && typeof h === "object" && String(h.name).toLowerCase() === lower);
	return found ? found.value : undefined;
};
const frozenHeaders = (list) => Object.freeze(list.map((h) => Object.freeze({ name: h.name, value: h.value })));
const isPre = input.phase === "pre";
const sent = input.request;
const request = isPre
	? Object.seal({
		method: sent.method, url: sent.url, headers: sent.headers, body: sent.body,
		getHeader: (name) => headerOf(request.headers, name),
		setHeader: (name, value) => {
			request.removeHeader(name);
			request.headers.push({ name: String(name), value: String(value) });
		},
		removeHeader: (name) => {
			const lower = String(name).toLowerCase();
			request.headers = request.headers.filter((h) => String(h && h.name).toLowerCase() !== lower);
		},
	})
	: Object.freeze({
		method: sent.method, url: sent.url, headers: frozenHeaders(sent.headers), body: sent.body,
		getHeader: (name) => headerOf(request.headers, name),
	});

const got = input.response;
let parsed;
let isParsed = false;
const response = got ? Object.freeze({
	status: got.status, statusText: got.statusText, headers: frozenHeaders(got.headers),
	size: got.size, finalUrl: got.finalUrl, truncated: got.truncated, timings: Object.freeze(got.timings),
	getHeader: (name) => headerOf(response.headers, name),
	text: () => bodyText,
	json: () => {
		if (!isParsed) {
			try { parsed = JSON.parse(bodyText); } catch (e) { throw new SyntaxError("lm.response.json(): the body is not valid JSON"); }
			isParsed = true;
		}
		return parsed;
	},
}) : undefined;

const tests = [];
// An entry stays failed until its callback completes, so a test cut short
// by the deadline (uncatchable) or a promise that never settles is not "passed".
const fail = (entry, error) => { entry.passed = false; entry.error = message(error); };
const pass = (entry) => { entry.passed = true; entry.error = null; };
const test = (name, fn) => {
	if (typeof fn !== "function") throw new TypeError("lm.test(name, fn): fn must be a function");
	if (tests.length >= TEST_MAX) throw new RangeError("lm.test: more than " + TEST_MAX + " tests");
	const entry = { name: cut(str(name), MESSAGE_MAX), passed: false, error: "Error: the test did not finish" };
	tests.push(entry);
	try {
		const out = fn();
		if (out !== null && typeof out === "object" && typeof out.then === "function") {
			out.then(() => pass(entry), (error) => fail(entry, error));
		} else {
			pass(entry);
		}
	} catch (error) {
		fail(entry, error);
	}
};

${SCRIPT_EXPECT_SOURCE}

const define = (name, value) => Object.defineProperty(globalThis, name, { value, writable: false, configurable: false });
define("lm", Object.freeze({ globals, collectionVariables, environment, variables, request, response, test, expect }));
define("console", Object.freeze({ log: record("log"), info: record("info"), warn: record("warn"), error: record("error") }));

return () => {
	let snapshot = null;
	let requestError = null;
	if (isPre) {
		try {
			const headers = Array.isArray(request.headers)
				? request.headers.map((h) => (h !== null && typeof h === "object" ? { name: h.name, value: h.value } : h))
				: request.headers;
			snapshot = { method: request.method, url: request.url, headers, body: request.body };
		} catch (error) {
			requestError = message(error);
		}
	}
	return stringify({
		request: snapshot, requestError, globals: globalValues, collectionVariables: collectionValues,
		environment: envValues, variables: varValues,
		tests: tests.map((t) => ({ name: t.name, passed: t.passed, error: t.error })),
		logs, logsTruncated,
	});
};
})`;
