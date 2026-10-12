/** Docs: the Custom responses page. `<em>` stresses a phrase. */
export const docsCustomResponses = {
	lead: "Reshape the body each endpoint returns, for example wrap a list in an object with the total record count, or turn an endpoint off entirely.",
	default: {
		title: "Default",
		body: 'Every endpoint has a response template. The default template is the string <code>"$mockData"</code>, meaning the body is the data itself: a list GET returns an array, a single GET returns an object, POST returns the new record, PUT and PATCH return the record after the change, DELETE returns the deleted record.',
	},
	edit: {
		title: "Edit a template",
		body: "Click Edit on the resource. The Endpoints section lists the five endpoints, each with an on/off switch and a Response template box that takes JSON. Click Update to save; the next request uses the new template right away.",
	},
	variables: {
		title: "Template variables",
		caption: "The three kinds of response template variables",
		headerVariable: "Variable",
		headerValue: "Value",
		mockData:
			"The data the endpoint returns without a template: the array of records (filtered, sorted, paged) for a list GET, one record for the other endpoints.",
		count:
			"Number of records. On a list GET it's the records matching the filter, counted before paging. On other endpoints it's the record count of the collection the route points to, counted after the write (on a nested route only the child records of that parent count).",
		faker:
			"A Faker value generated fresh on every request, for example {examples}. Any method in the schema's Faker picker works.",
		wholeString:
			'A string is replaced only when <em>the whole string</em> is a variable: <code>"Hello $name.firstName"</code> stays as written. Numbers, booleans, plain strings, nested objects and arrays stay; variables deep inside objects are still replaced. Unknown variables, like the typo <code>"$mockdata"</code>, are rejected when you save.',
	},
	count: {
		title: "List with the total record count",
		body: "This template makes the list GET endpoint return the page of data with the total record count, enough to draw a pager:",
		templateCaption: "Template of GET /customers",
		responseCaption: "GET /customers?page=2&limit=10 (shortened to 2 records)",
	},
	write: {
		title: "Wrap the record on writes",
		body: 'For POST, PUT and DELETE, <code>"$mockData"</code> is one record and <code>"$count"</code> is the record count after the write. PATCH shares the PUT template.',
		templateCaption: "Template of POST /customers",
		responseCaption: "POST /customers with body {body}",
	},
	limits: {
		title: "What a template doesn't change",
		body: 'A template only changes the body. The status code stays (200, or 201 for POST), and errors don\'t go through the template: 404 is still <code>"Not found"</code>, other errors are still <code>{errorShape}</code>.',
		size: "A template is at most {depth} levels deep, with at most {values} values and {faker} Faker variables. A rendered body over {mb} MB gets 422 <code>RESPONSE_TOO_LARGE</code>; lower the record count with <code>limit</code>.",
	},
	disable: {
		title: "Turn an endpoint off",
		body: "Turn off an endpoint's switch and that route returns 404 <code>\"Not found\"</code> on both flat and nested routes, while the other endpoints keep running. PATCH follows the PUT switch, HEAD follows GET. Example: turn DELETE off so people trying your demo can't delete the sample data.",
	},
} as const;
