// config/auth.js
import dotenv from "dotenv";
dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a strong secret with at least 32 characters');
}
const JWT_SECRET = process.env.JWT_SECRET;

export { JWT_SECRET };
