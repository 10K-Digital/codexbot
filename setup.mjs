import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ensureInstallation,writeFrontendConfiguration} from './configuration.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
writeFrontendConfiguration(root,ensureInstallation(root));
console.log('Codexbot initialized. Existing agents, history, memory and credentials were preserved.');
