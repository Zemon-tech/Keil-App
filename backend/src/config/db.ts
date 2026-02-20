import mongoose from "mongoose";
import { config } from "./index";

const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(config.mongodbUri);
        console.log(`✅ [database]: MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ [database]: Error: ${(error as Error).message}`);
        process.exit(1);
    }
};

export default connectDB;
