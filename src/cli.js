#!/usr/bin/env node

import ProxiedAxios from './index.js';

async function main() {
    const command = process.argv[2];

    if (command === 'setup') {
        const success = await ProxiedAxios.setup();
        process.exit(success ? 0 : 1);
    } else {
        console.error('Unknown command. Available commands: setup');
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
}); 