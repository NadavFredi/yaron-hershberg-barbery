#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
    try {
        log(`\n${colors.bold}${description}...${colors.reset}`);
        log(`${colors.blue}Running: ${command}${colors.reset}`);

        const output = execSync(command, {
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd()
        });

        log(`${colors.green}✅ ${description} completed successfully${colors.reset}`);
        if (output.trim()) {
            console.log(output);
        }
        return true;
    } catch (error) {
        log(`${colors.red}❌ ${description} failed${colors.reset}`);
        log(`${colors.red}Error: ${error.message}${colors.reset}`);
        if (error.stdout) {
            console.log('STDOUT:', error.stdout);
        }
        if (error.stderr) {
            console.log('STDERR:', error.stderr);
        }
        return false;
    }
}

function checkSupabaseProject() {
    log(`\n${colors.bold}Checking Supabase project status...${colors.reset}`);

    try {
        const output = execSync('supabase status', { encoding: 'utf8' });
        if (output.includes('supabase local development setup is running')) {
            log(`${colors.yellow}⚠️  Local Supabase is running. Make sure you're deploying to the correct project.${colors.reset}`);
        }
        return true;
    } catch (error) {
        log(`${colors.red}❌ Supabase CLI not found or not configured${colors.reset}`);
        log(`${colors.yellow}Please install Supabase CLI and run 'supabase login' first${colors.reset}`);
        return false;
    }
}

function getFunctionsList() {
    const functionsDir = join(process.cwd(), 'supabase', 'functions');

    if (!existsSync(functionsDir)) {
        log(`${colors.red}❌ Functions directory not found: ${functionsDir}${colors.reset}`);
        return [];
    }

    try {
        const functions = readdirSync(functionsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        log(`${colors.green}Found ${functions.length} functions: ${functions.join(', ')}${colors.reset}`);
        return functions;
    } catch (error) {
        log(`${colors.red}❌ Error reading functions directory: ${error.message}${colors.reset}`);
        return [];
    }
}

function deployFunction(functionName) {
    return execCommand(
        `supabase functions deploy ${functionName}`,
        `Deploying function: ${functionName}`
    );
}

function main() {
    log(`${colors.bold}${colors.blue}🚀 Supabase Edge Functions Deployment Script${colors.reset}`);
    log(`${colors.blue}================================================${colors.reset}`);

    // Check if we're in the right directory
    if (!existsSync('supabase/config.toml')) {
        log(`${colors.red}❌ Not in a Supabase project directory${colors.reset}`);
        log(`${colors.yellow}Please run this script from the project root${colors.reset}`);
        process.exit(1);
    }

    // Check Supabase project status
    if (!checkSupabaseProject()) {
        process.exit(1);
    }

    // Get list of functions
    const functions = getFunctionsList();
    if (functions.length === 0) {
        log(`${colors.red}❌ No functions found to deploy${colors.reset}`);
        process.exit(1);
    }

    // Deploy each function
    let successCount = 0;
    let failureCount = 0;

    for (const functionName of functions) {
        if (deployFunction(functionName)) {
            successCount++;
        } else {
            failureCount++;
        }
    }

    // Summary
    log(`\n${colors.bold}${colors.blue}📊 Deployment Summary${colors.reset}`);
    log(`${colors.blue}========================${colors.reset}`);
    log(`${colors.green}✅ Successful deployments: ${successCount}${colors.reset}`);
    if (failureCount > 0) {
        log(`${colors.red}❌ Failed deployments: ${failureCount}${colors.reset}`);
    }

    if (failureCount === 0) {
        log(`\n${colors.green}${colors.bold}🎉 All functions deployed successfully!${colors.reset}`);
    } else {
        log(`\n${colors.yellow}${colors.bold}⚠️  Some deployments failed. Please check the errors above.${colors.reset}`);
        process.exit(1);
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    log(`${colors.bold}Supabase Edge Functions Deployment Script${colors.reset}`);
    log(`\nUsage: node scripts/deploy-functions.js [options]`);
    log(`\nOptions:`);
    log(`  --help, -h    Show this help message`);
    log(`\nThis script will:`);
    log(`  1. Check Supabase project status`);
    log(`  2. Find all functions in supabase/functions/`);
    log(`  3. Deploy each function to Supabase`);
    log(`  4. Show deployment summary`);
    log(`\nMake sure you're logged in with: supabase login`);
    process.exit(0);
}

main();
