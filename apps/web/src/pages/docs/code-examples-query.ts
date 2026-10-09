import type { CodeExample } from "./code-example";

/** Filtering, sorting and paging a nested list. */
export const PAGINATION_EXAMPLE: CodeExample = {
	id: "pagination",
	code: {
		fetch: `// Unpaid orders of customer 3, largest first, page 2, 10 orders per page
const params = new URLSearchParams({
  paid: "false",
  sortBy: "quantity",
  order: "desc",
  page: "2",
  limit: "10",
});
const page2 = await fetch(\`\${BASE_URL}/customers/3/orders?\${params}\`).then((res) => res.json());
// page2 is an array of up to 10 orders (the 11th to 20th after filtering and sorting)

// Search a substring in every string field, take the first 5 results
const found = await fetch(\`\${BASE_URL}/customers?search=lan&l=5\`).then((res) => res.json());`,
		axios: `// Unpaid orders of customer 3, largest first, page 2, 10 orders per page
const { data: page2 } = await api.get("/customers/3/orders", {
  params: { paid: false, sortBy: "quantity", order: "desc", page: 2, limit: 10 },
});
// page2 is an array of up to 10 orders (the 11th to 20th after filtering and sorting)

// Search a substring in every string field, take the first 5 results
const { data: found } = await api.get("/customers", {
  params: { search: "lan", l: 5 },
});`,
		curl: `# Unpaid orders of customer 3, largest first, page 2, 10 orders per page
curl "$BASE_URL/customers/3/orders?paid=false&sortBy=quantity&order=desc&page=2&limit=10"

# Search a substring in every string field, take the first 5 results
curl "$BASE_URL/customers?search=lan&l=5"`,
	},
};

/** Telling "Not found" from coded errors, and honouring Retry-After. */
export const ERRORS_EXAMPLE: CodeExample = {
	id: "errors",
	code: {
		fetch: `async function request(path, init) {
  const res = await fetch(\`\${BASE_URL}\${path}\`, init);
  const body = await res.json();
  if (res.ok) return body;
  // 404 returns the string "Not found"; other errors return { error: { code, message } }
  const code = typeof body === "string" ? "NOT_FOUND" : body.error.code;
  // When code is RATE_LIMITED: seconds to wait before sending again
  const retryAfter = Number(res.headers.get("Retry-After") ?? 0);
  throw Object.assign(new Error(\`\${res.status} \${code}\`), { code, retryAfter });
}

const customer = await request("/customers/1");`,
		axios: `try {
  await api.get("/customers/999");
} catch (error) {
  if (!axios.isAxiosError(error) || !error.response) throw error;
  const { status, data, headers } = error.response;
  // 404 returns the string "Not found"; other errors return { error: { code, message } }
  const code = typeof data === "string" ? "NOT_FOUND" : data.error.code;
  // When code is RATE_LIMITED: seconds to wait before sending again
  const retryAfter = Number(headers["retry-after"] ?? 0);
  console.warn(status, code, retryAfter);
}`,
		curl: `# -i prints the headers too: status, Retry-After, X-Localman-Request-Id
curl -i "$BASE_URL/customers/999"
# 404, body: "Not found"

curl -i "$BASE_URL/customers?page=1&page=2"
# 400, body: {"error":{"code":"INVALID_QUERY","message":"Each query parameter may appear only once"}}`,
	},
};
