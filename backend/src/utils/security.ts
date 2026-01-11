import { scrypt, randomFill, createCipheriv, createDecipheriv } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const randomFillAsync = promisify(randomFill);

// Use a consistent secret for now (in production this should be an env var)
// Using a default for development if env var is missing
const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.APP_SECRET || 'dev-secret-key-min-32-chars-required-here!';

interface EncryptedData {
    encrypted: string;
    iv: string;
    authTag: string;
}

/**
 * Encrypt sensitive string data
 */
export async function encrypt(text: string): Promise<string> {
    if (!text) return text;

    const key = (await scryptAsync(SECRET_KEY, 'salt', 32)) as Buffer;
    const iv = (await randomFillAsync(new Uint8Array(12))) as Buffer;

    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt sensitive string data
 */
export async function decrypt(text: string): Promise<string> {
    if (!text) return text;

    const parts = text.split(':');
    if (parts.length !== 3) {
        // Assume plain text if not in correct format (migration support)
        return text;
    }

    const [ivHex, authTagHex, encryptedHex] = parts;

    const key = (await scryptAsync(SECRET_KEY, 'salt', 32)) as Buffer;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
