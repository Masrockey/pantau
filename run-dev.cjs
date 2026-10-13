const { spawn } = require('child_process');

console.log('\x1b[32m%s\x1b[0m', '========================================================');
console.log('\x1b[32m%s\x1b[0m', '  Menjalankan composer run dev & node gbpscrap/dist/index.js');
console.log('\x1b[32m%s\x1b[0m', '========================================================\n');

function runProcess(command, args, label, color) {
    const isWindows = process.platform === 'win32';
    const proc = spawn(command, args, {
        shell: isWindows,
        stdio: ['inherit', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (data) => {
        data.toString().trimEnd().split('\n').forEach((line) => {
            console.log(`${color}[${label}]\x1b[0m ${line}`);
        });
    });

    proc.stderr.on('data', (data) => {
        data.toString().trimEnd().split('\n').forEach((line) => {
            console.error(`${color}[${label} ERR]\x1b[0m ${line}`);
        });
    });

    proc.on('close', (code) => {
        console.log(`${color}[${label}]\x1b[0m Process exited with code ${code}`);
    });

    return proc;
}

const composer = runProcess('composer', ['run', 'dev'], 'COMPOSER', '\x1b[36m'); // Cyan
const scraper = runProcess('node', ['gbpscrap/dist/index.js'], 'SCRAPER', '\x1b[33m'); // Yellow

const shutdown = () => {
    console.log('\n\x1b[31mMenghentikan semua proses...\x1b[0m');
    if (composer && !composer.killed) composer.kill();
    if (scraper && !scraper.killed) scraper.kill();
    process.exit();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
