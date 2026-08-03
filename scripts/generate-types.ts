import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString, type OpenAPI3 } from 'openapi-typescript';
import { format, resolveConfig } from 'prettier';
import { TYPES_PATH, readPin, readVendoredContract } from './lib/contract.ts';

const pin = await readPin();
const doc = (await readVendoredContract()) as unknown as OpenAPI3;

const banner = `/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Source:  contract/openapi.json
 * Backend: ${pin}
 * Command: pnpm generate:types
 */

`;

const ast = await openapiTS(doc, { alphabetize: true, emptyObjectsUnknown: true });
const body = astToString(ast);

const prettierConfig = await resolveConfig(TYPES_PATH);
const contents = await format(banner + body, { ...prettierConfig, filepath: TYPES_PATH });

const previous = await readFile(TYPES_PATH, 'utf8').catch(() => '');
if (previous === contents) {
  console.log('src/types/api.d.ts is up to date.');
} else {
  await writeFile(TYPES_PATH, contents);
  console.log(`src/types/api.d.ts regenerated from ${pin}.`);
}
