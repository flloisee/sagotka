import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(dir, '..', '.env');

if (existsSync(envFile)) {
  loadEnvFile(envFile);
}