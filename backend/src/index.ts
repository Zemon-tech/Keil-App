import app from "./app";
import { config } from "./config";

const port = config.port;

// Start the server
app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
