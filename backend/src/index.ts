import app from "./app";
import { config } from "./config";
import connectDB from "./config/db";
import "./config/supabase";

const port = config.port;

// Start the server
const startServer = async () => {
    try {
        await connectDB();
        app.listen(port, () => {
            console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
    }
};

startServer();
