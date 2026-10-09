import type { CodeExample } from "./code-example";

/** Filtering, sorting and paging a nested list. */
export const PAGINATION_EXAMPLE: CodeExample = {
	id: "pagination",
	title: "Lọc, sắp xếp và phân trang",
	code: {
		fetch: `// Order chưa thanh toán của customer 3, nhiều nhất trước, trang 2, 10 order mỗi trang
const params = new URLSearchParams({
  paid: "false",
  sortBy: "quantity",
  order: "desc",
  page: "2",
  limit: "10",
});
const page2 = await fetch(\`\${BASE_URL}/customers/3/orders?\${params}\`).then((res) => res.json());
// page2 là mảng tối đa 10 order (thứ 11 đến 20 sau khi lọc và sắp xếp)

// Tìm chuỗi con trong mọi field chuỗi, lấy 5 kết quả đầu
const found = await fetch(\`\${BASE_URL}/customers?search=lan&l=5\`).then((res) => res.json());`,
		axios: `// Order chưa thanh toán của customer 3, nhiều nhất trước, trang 2, 10 order mỗi trang
const { data: page2 } = await api.get("/customers/3/orders", {
  params: { paid: false, sortBy: "quantity", order: "desc", page: 2, limit: 10 },
});
// page2 là mảng tối đa 10 order (thứ 11 đến 20 sau khi lọc và sắp xếp)

// Tìm chuỗi con trong mọi field chuỗi, lấy 5 kết quả đầu
const { data: found } = await api.get("/customers", {
  params: { search: "lan", l: 5 },
});`,
		curl: `# Order chưa thanh toán của customer 3, nhiều nhất trước, trang 2, 10 order mỗi trang
curl "$BASE_URL/customers/3/orders?paid=false&sortBy=quantity&order=desc&page=2&limit=10"

# Tìm chuỗi con trong mọi field chuỗi, lấy 5 kết quả đầu
curl "$BASE_URL/customers?search=lan&l=5"`,
	},
};

/** Telling "Not found" from coded errors, and honouring Retry-After. */
export const ERRORS_EXAMPLE: CodeExample = {
	id: "errors",
	title: "Xử lý lỗi",
	code: {
		fetch: `async function request(path, init) {
  const res = await fetch(\`\${BASE_URL}\${path}\`, init);
  const body = await res.json();
  if (res.ok) return body;
  // 404 trả chuỗi "Not found"; lỗi khác trả { error: { code, message } }
  const code = typeof body === "string" ? "NOT_FOUND" : body.error.code;
  // Khi code là RATE_LIMITED: số giây nên chờ trước khi gửi lại
  const retryAfter = Number(res.headers.get("Retry-After") ?? 0);
  throw Object.assign(new Error(\`\${res.status} \${code}\`), { code, retryAfter });
}

const customer = await request("/customers/1");`,
		axios: `try {
  await api.get("/customers/999");
} catch (error) {
  if (!axios.isAxiosError(error) || !error.response) throw error;
  const { status, data, headers } = error.response;
  // 404 trả chuỗi "Not found"; lỗi khác trả { error: { code, message } }
  const code = typeof data === "string" ? "NOT_FOUND" : data.error.code;
  // Khi code là RATE_LIMITED: số giây nên chờ trước khi gửi lại
  const retryAfter = Number(headers["retry-after"] ?? 0);
  console.warn(status, code, retryAfter);
}`,
		curl: `# -i in cả header: mã trạng thái, Retry-After, X-Localman-Request-Id
curl -i "$BASE_URL/customers/999"
# 404, body: "Not found"

curl -i "$BASE_URL/customers?page=1&page=2"
# 400, body: {"error":{"code":"INVALID_QUERY","message":"Each query parameter may appear only once"}}`,
	},
};
