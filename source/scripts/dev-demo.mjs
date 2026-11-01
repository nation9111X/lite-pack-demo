// Разработка в демо-режиме (без сервера магазина): npm run dev:demo [-- --port 5193]
import { spawn } from 'node:child_process';
import { writeDemoData } from './demo-data.mjs';
import path from 'node:path';

writeDemoData(path.resolve('tools/.cache/demo'));
spawn('npx vite ' + process.argv.slice(2).join(' '), { stdio: 'inherit', shell: true, env: { ...process.env, VITE_DEMO: '1' } }).on('exit', (c) => process.exit(c ?? 0));
