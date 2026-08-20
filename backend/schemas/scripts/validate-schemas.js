'use strict';

/**
 * Validates all JSON Schema files in the schemas/ directory.
 * Run with: npm run validate
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const schemasDir = path.join(__dirname, '..', 'schemas');
const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.json'));

let allValid = true;

for (const file of files) {
  const schemaPath = path.join(schemasDir, file);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  try {
    const validate = ajv.compile(schema);
    // Validate the schema itself against draft-07 meta-schema
    const valid = ajv.validateSchema(schema);
    if (valid) {
      console.log(`✓ ${file} — valid schema`);
    } else {
      console.error(`✗ ${file} — schema validation failed:`, ajv.errors);
      allValid = false;
    }
  } catch (err) {
    console.error(`✗ ${file} — error:`, err.message);
    allValid = false;
  }
}

if (!allValid) {
  process.exit(1);
}

console.log('\nAll schemas valid.');
