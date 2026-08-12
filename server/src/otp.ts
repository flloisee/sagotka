import { randomInt } from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import {
  createOtp,
  getOtpForVerify,
  getUnexpiredOtp,
  incrementOtpAttempts,
  refreshOtp,
  deleteOtp,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  type OtpPurpose,
} from './repo.js';
import { sendOtpEmail } from './mailer.js';

export function generateCode(): string {
  const digits = Array.from({ length: 6 }, () => randomInt(0, 10));
  return digits.join('');
}

async function hashCode(code: string): Promise<string> {
  return hash(code, { algorithm: Algorithm.Argon2id });
}

export async function issueOtp(email: string, purpose: OtpPurpose): Promise<void> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const codeHash = await hashCode(code);
  const existing = getUnexpiredOtp(email, purpose);
  if (existing) {
    refreshOtp(existing.id, codeHash, expiresAt);
  } else {
    createOtp({ email, purpose, codeHash, expiresAt });
  }
  await sendOtpEmail(email, code);
}

export async function verifyOtp(
  email: string,
  code: string,
  purpose: OtpPurpose,
): Promise<boolean> {
  const otp = getOtpForVerify(email, purpose);
  if (!otp) return false;
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    deleteOtp(otp.id);
    return false;
  }
  const matches = await verify(otp.codeHash, code);
  if (!matches) {
    incrementOtpAttempts(otp.id);
    return false;
  }
  deleteOtp(otp.id);
  return true;
}

export async function checkOtp(
  email: string,
  code: string,
  purpose: OtpPurpose,
): Promise<boolean> {
  const otp = getOtpForVerify(email, purpose);
  if (!otp) return false;
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    deleteOtp(otp.id);
    return false;
  }
  const matches = await verify(otp.codeHash, code);
  if (!matches) {
    incrementOtpAttempts(otp.id);
    return false;
  }
  return true;
}
