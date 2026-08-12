const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (!SITE_KEY) return Promise.resolve();
  if (window.grecaptcha) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-recaptcha-script]',
      ) as HTMLScriptElement | null;
      if (existing && window.grecaptcha) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`;
      s.setAttribute('data-recaptcha-script', '');
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load reCAPTCHA.'));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function captchaSiteKey(): string | undefined {
  return SITE_KEY;
}

/**
 * Execute a reCAPTCHA v3 action and resolve with the resulting token.
 * When no site key is configured (dev), resolves with an empty token so the
 * server's dev fallback can proceed.
 */
export async function executeCaptcha(action: string): Promise<string> {
  if (!SITE_KEY || !window.grecaptcha) {
    await loadScript();
    if (!window.grecaptcha || !SITE_KEY) return '';
  }
  return new Promise<string>((resolve, reject) => {
    const g = window.grecaptcha!;
    g.ready(async () => {
      try {
        const token = await g.execute(SITE_KEY!, { action });
        resolve(token);
      } catch (err) {
        reject(err);
      }
    });
  });
}
