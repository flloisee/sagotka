const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const THRESHOLD = 0.5;

interface SiteVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

function secret(): string {
  return process.env.GOOGLE_RECAPTCHA_SECRET ?? '';
}

export function recaptchaEnabled(): boolean {
  return secret().length > 0;
}

export async function verifyRecaptcha(token: string): Promise<boolean> {
  if (!recaptchaEnabled()) return true;
  if (!token) return false;

  const body = new URLSearchParams({ secret: secret(), response: token });
  let res: Response;
  try {
    res = await fetch(VERIFY_URL, { method: 'POST', body });
  } catch {
    return false;
  }

  if (!res.ok) return false;

  let data: SiteVerifyResponse;
  try {
    data = (await res.json()) as SiteVerifyResponse;
  } catch {
    return false;
  }

  if (!data.success) return false;
  const score = typeof data.score === 'number' ? data.score : 0;
  return score >= THRESHOLD;
}
