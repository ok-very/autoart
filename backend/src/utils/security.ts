import { scrypt, randomFill, createCipheriv, createDecipheriv } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const randomFillAsync = promisify(randomFill);

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY_DEV = 'dev-secret-key-min-32-chars-required-here!';

// Fail fast in production if APP_SECRET is missing
if (process.env.NODE_ENV === 'production' && !process.env.APP_SECRET) {
    throw new Error('Fatal: APP_SECRET environment variable is required in production');
}

const EFFECTIVE_SECRET = process.env.APP_SECRET || SECRET_KEY_DEV;

// Cache key derivation to avoid expensive scryptAsync on every operation
let cachedKey: Buffer | null = null;
async function getDerivedKey(): Promise<Buffer> {
    if (!cachedKey) {
        cachedKey = (await scryptAsync(EFFECTIVE_SECRET, 'salt', 32)) as Buffer;
    }
    return cachedKey;
}

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

    const key = await getDerivedKey();
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

    try {
        const key = await getDerivedKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        // Log minimal non-sensitive error message
        console.error('Decryption failed: authentication error or corrupt data');
        // Return original text for migration compatibility
        return text;
    }
}

