import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        globalSetup: ["./src/test/globalSetup.ts"],
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.test.ts"],
        // Run test files sequentially to avoid port conflicts on socket tests
        fileParallelism: false,
        testTimeout: 15000,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
