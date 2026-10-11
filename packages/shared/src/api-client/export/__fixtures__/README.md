# Test fixtures of the Collection v2.1 export

`collection-v2.1.0.schema.json` is the official Postman Collection Format
v2.1.0 JSON Schema (draft-04), copied from
<https://schema.postman.com/json/collection/v2.1.0/collection.json>
(project [postmanlabs/schemas](https://github.com/postmanlabs/schemas),
Apache License 2.0). Only the whitespace was reformatted to the repo's Biome
style; the content is unchanged. The tests validate every exported
collection against it (`v21-schema-test-utils.ts`, with `ajv` and `ajv-draft-04`, both
dev dependencies).
