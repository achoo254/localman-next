import type { CodeExample } from "./code-example";
import { EXAMPLE_BASE_URL } from "./docs-pages";

/** Reads and writes on the flat route of `customers`. */
export const CRUD_EXAMPLE: CodeExample = {
	id: "crud",
	code: {
		fetch: `const BASE_URL = "${EXAMPLE_BASE_URL}"; // add the prefix if the project has one
const JSON_HEADERS = { "Content-Type": "application/json" };

// A list, then one record
const customers = await fetch(\`\${BASE_URL}/customers\`).then((res) => res.json());
const first = await fetch(\`\${BASE_URL}/customers/1\`).then((res) => res.json());

// Create: 201, returns the record with its id
const created = await fetch(\`\${BASE_URL}/customers\`, {
  method: "POST",
  headers: JSON_HEADERS,
  body: JSON.stringify({ name: "Lan Anh" }),
}).then((res) => res.json());

// Update: PATCH and PUT both overwrite only the fields you send
await fetch(\`\${BASE_URL}/customers/\${created.id}\`, {
  method: "PATCH",
  headers: JSON_HEADERS,
  body: JSON.stringify({ name: "Lan Anh Nguyen" }),
});

// Delete: returns the deleted record
await fetch(\`\${BASE_URL}/customers/\${created.id}\`, { method: "DELETE" });`,
		axios: `import axios from "axios";

const api = axios.create({
  baseURL: "${EXAMPLE_BASE_URL}", // add the prefix if the project has one
});

// A list, then one record
const { data: customers } = await api.get("/customers");
const { data: first } = await api.get("/customers/1");

// Create: 201, returns the record with its id
const { data: created } = await api.post("/customers", { name: "Lan Anh" });

// Update: PATCH and PUT both overwrite only the fields you send
await api.patch(\`/customers/\${created.id}\`, { name: "Lan Anh Nguyen" });

// Delete: returns the deleted record
await api.delete(\`/customers/\${created.id}\`);`,
		curl: `BASE_URL="${EXAMPLE_BASE_URL}"  # add the prefix if the project has one

# A list, then one record
curl "$BASE_URL/customers"
curl "$BASE_URL/customers/1"

# Create: 201, returns the record with its id
curl -X POST "$BASE_URL/customers" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Lan Anh"}'

# Update: PATCH and PUT both overwrite only the fields you send
curl -X PATCH "$BASE_URL/customers/1" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Lan Anh Nguyen"}'

# Delete: returns the deleted record
curl -X DELETE "$BASE_URL/customers/1"`,
	},
};

/** `orders` nested under `customers`: nested and flat routes. */
export const NESTED_EXAMPLE: CodeExample = {
	id: "nested",
	code: {
		fetch: `// Orders of customer 3
const orders = await fetch(\`\${BASE_URL}/customers/3/orders\`).then((res) => res.json());

// Create an order for customer 3: customerId comes from the path
const order = await fetch(\`\${BASE_URL}/customers/3/orders\`, {
  method: "POST",
  headers: JSON_HEADERS,
  body: JSON.stringify({ product: "Keyboard", quantity: 2, paid: false }),
}).then((res) => res.json());
// order.customerId === "3"

// Mark it as paid
await fetch(\`\${BASE_URL}/customers/3/orders/\${order.id}\`, {
  method: "PUT",
  headers: JSON_HEADERS,
  body: JSON.stringify({ paid: true }),
});

// Flat route: the body needs the customerId of an existing customer
await fetch(\`\${BASE_URL}/orders\`, {
  method: "POST",
  headers: JSON_HEADERS,
  body: JSON.stringify({ customerId: "3", product: "Mouse", quantity: 1 }),
});`,
		axios: `// Orders of customer 3
const { data: orders } = await api.get("/customers/3/orders");

// Create an order for customer 3: customerId comes from the path
const { data: order } = await api.post("/customers/3/orders", {
  product: "Keyboard",
  quantity: 2,
  paid: false,
});
// order.customerId === "3"

// Mark it as paid
await api.put(\`/customers/3/orders/\${order.id}\`, { paid: true });

// Flat route: the body needs the customerId of an existing customer
await api.post("/orders", { customerId: "3", product: "Mouse", quantity: 1 });`,
		curl: `# Orders of customer 3
curl "$BASE_URL/customers/3/orders"

# Create an order for customer 3: customerId comes from the path
curl -X POST "$BASE_URL/customers/3/orders" \\
  -H "Content-Type: application/json" \\
  -d '{"product":"Keyboard","quantity":2,"paid":false}'

# Mark order 12 of customer 3 as paid
curl -X PUT "$BASE_URL/customers/3/orders/12" \\
  -H "Content-Type: application/json" \\
  -d '{"paid":true}'

# Flat route: the body needs the customerId of an existing customer
curl -X POST "$BASE_URL/orders" \\
  -H "Content-Type: application/json" \\
  -d '{"customerId":"3","product":"Mouse","quantity":1}'`,
	},
};
