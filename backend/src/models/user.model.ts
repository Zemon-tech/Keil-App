import mongoose, { Schema, Document } from "mongoose";

/**
 * Interface representing a User document in MongoDB.
 * Links to Supabase authentication via the supabaseId.
 */
export interface IUser extends Document {
    supabaseId: string;
    fullName?: string;
    email: string;
    role: "user" | "admin";
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>(
    {
        supabaseId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        fullName: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },
    },
    {
        timestamps: true,
    }
);

/**
 * Mongoose model for User collection.
 */
export default mongoose.model<IUser>("User", userSchema);
