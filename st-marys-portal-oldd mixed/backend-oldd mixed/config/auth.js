// config/auth.js
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "st-marys-portal-secret-key-2024";
console.log('JWT_SECRET configured:', JWT_SECRET ? 'Yes' : 'No'); // Debug log

export { JWT_SECRET };