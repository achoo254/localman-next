import type { CodeExample } from "./code-example";
import { EXAMPLE_BASE_URL } from "./docs-pages";

/** Reads and writes on the flat route of `customers`. */
export const CRUD_EXAMPLE: CodeExample = {
	id: "crud",
	title: "Đọc và ghi trên route phẳng",
	code: {
		fetch: `const BASE_URL = "${EXAMPLE_BASE_URL}"; // thêm prefix nếu project có
const JSON_HEADERS = { "Content-Type": "application/json" };

// Danh sách, rồi một bản ghi
const customers = await fetch(\`\${BASE_URL}/customers\`).then((res) => res.json());
const first = await fetch(\`\${BASE_URL}/customers/1\`).then((res) => res.json());

// Tạo: 201, nhận lại bản ghi kèm id
const created = await fetch(\`\${BASE_URL}/customers\`, {
  method: "POST",
  headers: JSON_HEADERS,
  body: JSON.stringify({ name: "Lan Anh" }),
}).then((res) => res.json());

// Sửa: PATCH và PUT đều chỉ ghi đè các field gửi lên
await fetch(\`\${BASE_URL}/customers/\${created.id}\`, {
  method: "PATCH",
  headers: JSON_HEADERS,
  body: JSON.stringify({ name: "Lan Anh Nguyễn" }),
});

// Xoá: nhận lại bản ghi vừa xoá
await fetch(\`\${BASE_URL}/customers/\${created.id}\`, { method: "DELETE" });`,
		axios: `import axios from "axios";

const api = axios.create({
  baseURL: "${EXAMPLE_BASE_URL}", // thêm prefix nếu project có
});

// Danh sách, rồi một bản ghi
const { data: customers } = await api.get("/customers");
const { data: first } = await api.get("/customers/1");

// Tạo: 201, nhận lại bản ghi kèm id
const { data: created } = await api.post("/customers", { name: "Lan Anh" });

// Sửa: PATCH và PUT đều chỉ ghi đè các field gửi lên
await api.patch(\`/customers/\${created.id}\`, { name: "Lan Anh Nguyễn" });

// Xoá: nhận lại bản ghi vừa xoá
await api.delete(\`/customers/\${created.id}\`);`,
		curl: `BASE_URL="${EXAMPLE_BASE_URL}"  # thêm prefix nếu project có

# Danh sách, rồi một bản ghi
curl "$BASE_URL/customers"
curl "$BASE_URL/customers/1"

# Tạo: 201, nhận lại bản ghi kèm id
curl -X POST "$BASE_URL/customers" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Lan Anh"}'

# Sửa: PATCH và PUT đều chỉ ghi đè các field gửi lên
curl -X PATCH "$BASE_URL/customers/1" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Lan Anh Nguyễn"}'

# Xoá: nhận lại bản ghi vừa xoá
curl -X DELETE "$BASE_URL/customers/1"`,
	},
};

/** `orders` nested under `customers`: nested and flat routes. */
export const NESTED_EXAMPLE: CodeExample = {
	id: "nested",
	title: "Route lồng",
	code: {
		fetch: `// Các order của customer 3
const orders = await fetch(\`\${BASE_URL}/customers/3/orders\`).then((res) => res.json());

// Tạo order cho customer 3: customerId lấy từ đường dẫn
const order = await fetch(\`\${BASE_URL}/customers/3/orders\`, {
  method: "POST",
  headers: JSON_HEADERS,
  body: JSON.stringify({ product: "Bàn phím", quantity: 2, paid: false }),
}).then((res) => res.json());
// order.customerId === "3"

// Đánh dấu đã thanh toán
await fetch(\`\${BASE_URL}/customers/3/orders/\${order.id}\`, {
  method: "PUT",
  headers: JSON_HEADERS,
  body: JSON.stringify({ paid: true }),
});

// Route phẳng: body phải có customerId của một customer có thật
await fetch(\`\${BASE_URL}/orders\`, {
  method: "POST",
  headers: JSON_HEADERS,
  body: JSON.stringify({ customerId: "3", product: "Chuột", quantity: 1 }),
});`,
		axios: `// Các order của customer 3
const { data: orders } = await api.get("/customers/3/orders");

// Tạo order cho customer 3: customerId lấy từ đường dẫn
const { data: order } = await api.post("/customers/3/orders", {
  product: "Bàn phím",
  quantity: 2,
  paid: false,
});
// order.customerId === "3"

// Đánh dấu đã thanh toán
await api.put(\`/customers/3/orders/\${order.id}\`, { paid: true });

// Route phẳng: body phải có customerId của một customer có thật
await api.post("/orders", { customerId: "3", product: "Chuột", quantity: 1 });`,
		curl: `# Các order của customer 3
curl "$BASE_URL/customers/3/orders"

# Tạo order cho customer 3: customerId lấy từ đường dẫn
curl -X POST "$BASE_URL/customers/3/orders" \\
  -H "Content-Type: application/json" \\
  -d '{"product":"Bàn phím","quantity":2,"paid":false}'

# Đánh dấu đã thanh toán order 12 của customer 3
curl -X PUT "$BASE_URL/customers/3/orders/12" \\
  -H "Content-Type: application/json" \\
  -d '{"paid":true}'

# Route phẳng: body phải có customerId của một customer có thật
curl -X POST "$BASE_URL/orders" \\
  -H "Content-Type: application/json" \\
  -d '{"customerId":"3","product":"Chuột","quantity":1}'`,
	},
};
