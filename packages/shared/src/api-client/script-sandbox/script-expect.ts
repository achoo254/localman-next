/**
 * Source of `lm.expect`, a small chai-like assertion library that runs
 * inside QuickJS. A failed assertion throws an `AssertionError` in the VM,
 * so `lm.test` records it and a bare `lm.expect` stops the script; nothing
 * is returned to the host as a value that could be mistaken for success.
 *
 * Expects `str(value)` from the enclosing prelude.
 */
export const SCRIPT_EXPECT_SOURCE = String.raw`
class AssertionError extends Error {
	constructor(message) {
		super(message);
		this.name = "AssertionError";
	}
}
const show = (value) => {
	const text = typeof value === "string" ? JSON.stringify(value) : str(value);
	return text.length > 120 ? text.slice(0, 120) + "..." : text;
};
const typeOf = (value) =>
	value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
const deepEqual = (a, b, depth) => {
	if (a === b || (a !== a && b !== b)) return true;
	if (depth > 100 || typeOf(a) !== typeOf(b) || typeof a !== "object") return false;
	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	if (keysA.length !== keysB.length) return false;
	return keysA.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k], depth + 1));
};
const includes = (haystack, needle, deep) => {
	const same = (x) => (deep ? deepEqual(x, needle, 0) : x === needle);
	if (typeof haystack === "string") return haystack.includes(String(needle));
	if (Array.isArray(haystack)) return haystack.some(same);
	if (haystack !== null && typeof haystack === "object" && needle !== null && typeof needle === "object")
		return Object.keys(needle).every((k) => deepEqual(haystack[k], needle[k], 0));
	return false;
};
const CHAIN_WORDS = ["to", "be", "been", "is", "that", "which", "and", "has", "have", "with", "at", "of", "same", "does"];
const expect = (actual) => {
	const flags = { negate: false, deep: false };
	const a = {};
	const check = (ok, what) => {
		if (Boolean(ok) === flags.negate) {
			throw new AssertionError("expected " + show(actual) + (flags.negate ? " not " : " ") + what);
		}
		return a;
	};
	const getter = (name, get) => Object.defineProperty(a, name, { get });
	for (const word of CHAIN_WORDS) getter(word, () => a);
	getter("not", () => { flags.negate = !flags.negate; return a; });
	getter("deep", () => { flags.deep = true; return a; });
	getter("ok", () => check(actual, "to be truthy"));
	getter("true", () => check(actual === true, "to be true"));
	getter("false", () => check(actual === false, "to be false"));
	getter("null", () => check(actual === null, "to be null"));
	getter("undefined", () => check(actual === undefined, "to be undefined"));
	getter("NaN", () => check(Number.isNaN(actual), "to be NaN"));
	getter("exist", () => check(actual !== null && actual !== undefined, "to exist"));
	getter("empty", () => {
		const size = typeof actual === "string" || Array.isArray(actual) ? actual.length
			: actual !== null && typeof actual === "object" ? Object.keys(actual).length : -1;
		return check(size === 0, "to be empty");
	});
	const method = (names, fn) => { for (const name of names) a[name] = fn; };
	method(["equal", "equals", "eq"], (e) =>
		check(flags.deep ? deepEqual(actual, e, 0) : actual === e, (flags.deep ? "to deeply equal " : "to equal ") + show(e)));
	method(["eql", "eqls"], (e) => check(deepEqual(actual, e, 0), "to deeply equal " + show(e)));
	method(["above", "gt", "greaterThan"], (n) => check(actual > n, "to be above " + show(n)));
	method(["below", "lt", "lessThan"], (n) => check(actual < n, "to be below " + show(n)));
	method(["least", "gte"], (n) => check(actual >= n, "to be at least " + show(n)));
	method(["most", "lte"], (n) => check(actual <= n, "to be at most " + show(n)));
	method(["a", "an"], (type) => check(typeOf(actual) === String(type).toLowerCase(), "to be a " + type));
	method(["include", "includes", "contain", "contains"], (v) => check(includes(actual, v, flags.deep), "to include " + show(v)));
	method(["oneOf"], (list) => check(Array.isArray(list) && includes(list, actual, flags.deep), "to be one of " + show(list)));
	method(["match", "matches"], (re) => check(re instanceof RegExp && re.test(String(actual)), "to match " + String(re)));
	method(["lengthOf"], (n) => check(actual !== null && actual !== undefined && actual.length === n, "to have length " + n));
	method(["status"], (code) => check(actual !== null && typeof actual === "object" && actual.status === code, "to have status " + code));
	method(["property"], function (name, value) {
		const has = actual !== null && actual !== undefined && name in Object(actual);
		if (arguments.length < 2) return check(has, "to have property " + show(name));
		const got = has ? Object(actual)[name] : undefined;
		const same = flags.deep ? deepEqual(got, value, 0) : got === value;
		return check(has && same, "to have property " + show(name) + " of " + show(value));
	});
	method(["toBe"], (e) => check(actual === e, "to be " + show(e)));
	method(["toEqual"], (e) => check(deepEqual(actual, e, 0), "to equal " + show(e)));
	method(["toContain"], (v) => check(includes(actual, v, false), "to contain " + show(v)));
	method(["toHaveProperty"], (name) => a.property(name));
	method(["toBeGreaterThan"], (n) => a.above(n));
	method(["toBeLessThan"], (n) => a.below(n));
	return a;
};
`;
