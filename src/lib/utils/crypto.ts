import type { EncryptedCredentials } from '@/types';

/**
 * Credential encryption manager using Web Crypto API
 */
export class CredentialManager {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly ITERATIONS = 100000;

  /**
   * Generate a random salt
   */
  private static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Generate a random IV
   */
  private static generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(12));
  }

  /**
   * Derive an encryption key from a password
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as unknown as BufferSource,
        iterations: this.ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Get or create a device-specific key
   */
  private static async getDeviceKey(): Promise<string> {
    const stored = await chrome.storage.local.get('deviceKey');
    if (stored.deviceKey) {
      return stored.deviceKey;
    }

    const key = crypto.getRandomValues(new Uint8Array(32));
    const keyString = Array.from(key)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    await chrome.storage.local.set({ deviceKey: keyString });
    return keyString;
  }

  /**
   * Encrypt sensitive data
   */
  static async encrypt(data: string): Promise<EncryptedCredentials> {
    const deviceKey = await this.getDeviceKey();
    const salt = this.generateSalt();
    const iv = this.generateIV();
    const key = await this.deriveKey(deviceKey, salt);

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv: iv as unknown as BufferSource },
      key,
      dataBuffer
    );

    const encrypted = Array.from(new Uint8Array(encryptedBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      encrypted,
      iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
      salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''),
    };
  }

  /**
   * Decrypt sensitive data
   */
  static async decrypt(credentials: EncryptedCredentials): Promise<string> {
    const deviceKey = await this.getDeviceKey();

    const salt = new Uint8Array(
      credentials.salt.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );
    const iv = new Uint8Array(
      credentials.iv.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );
    const encrypted = new Uint8Array(
      credentials.encrypted.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );

    const key = await this.deriveKey(deviceKey, salt);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: this.ALGORITHM, iv: iv as unknown as BufferSource },
      key,
      encrypted as unknown as BufferSource
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Encrypt credentials object (username/password, token, etc.)
   */
  static async encryptCredentials<T extends Record<string, string>>(
    credentials: T
  ): Promise<EncryptedCredentials> {
    const json = JSON.stringify(credentials);
    return this.encrypt(json);
  }

  /**
   * Decrypt credentials object
   */
  static async decryptCredentials<T extends Record<string, string>>(
    encrypted: EncryptedCredentials
  ): Promise<T> {
    const json = await this.decrypt(encrypted);
    return JSON.parse(json);
  }
}

export default CredentialManager;
