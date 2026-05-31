// Simulate what globalSetup does
require('dotenv').config();

if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/keil_test";
}

console.log("DATABASE_URL after override:", process.env.DATABASE_URL);

// Now load config the same way the app does
const { config } = require('../dist/config/index.js');
console.log("config.databaseUrl:", config.databaseUrl);
