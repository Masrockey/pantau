import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserContext } from 'playwright';
import { log } from 'crawlee';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  expires?: number;
}

class CookieManager {
  private cachedCookies: PlaywrightCookie[] | null = null;
  private cookiesFilePath: string | null = null;

  /**
   * Find candidate paths where cookies.json might be located
   */
  private getCandidatePaths(): string[] {
    const candidates = [];
    if (process.env.GOOGLE_COOKIES_PATH) {
      candidates.push(path.resolve(process.env.GOOGLE_COOKIES_PATH));
    }
    candidates.push(
      path.resolve(process.cwd(), 'cookies.json'),
      path.resolve(process.cwd(), '..', 'cookies.json'),
      path.resolve(__dirname, '..', '..', 'cookies.json'),
      path.resolve(__dirname, '..', '..', '..', 'cookies.json')
    );
    return Array.from(new Set(candidates));
  }

  /**
   * Load and sanitize cookies from cookies.json
   */
  public loadCookies(): PlaywrightCookie[] {
    if (this.cachedCookies !== null) {
      return this.cachedCookies;
    }

    const candidatePaths = this.getCandidatePaths();
    let foundPath: string | null = null;
    let rawContent = '';

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          rawContent = fs.readFileSync(p, 'utf8');
          foundPath = p;
          break;
        } catch {
          // Continue to next candidate
        }
      }
    }

    if (!foundPath || !rawContent) {
      this.cachedCookies = [];
      return [];
    }

    this.cookiesFilePath = foundPath;

    try {
      const parsed = JSON.parse(rawContent);
      const rawList = Array.isArray(parsed) ? parsed : (parsed.cookies || []);
      const valid: PlaywrightCookie[] = [];

      for (const c of rawList) {
        if (!c.name || c.value === undefined) continue;
        const domain = (c.domain || '').toLowerCase();
        // Accept google domains
        if (!domain.includes('google.')) continue;

        const cookie: PlaywrightCookie = {
          name: c.name,
          value: String(c.value),
          domain: c.domain,
          path: c.path || '/',
          secure: Boolean(c.secure),
          httpOnly: Boolean(c.httpOnly),
        };

        if (c.sameSite) {
          const s = String(c.sameSite).toLowerCase();
          if (s === 'lax') cookie.sameSite = 'Lax';
          else if (s === 'strict') cookie.sameSite = 'Strict';
          else if (s === 'none' || s === 'no_restriction') cookie.sameSite = 'None';
        }

        // Playwright/Chromium requirement: if sameSite is None, secure must be true
        if (cookie.sameSite === 'None') {
          cookie.secure = true;
        }

        if (c.expirationDate && c.expirationDate > Date.now() / 1000) {
          cookie.expires = Math.floor(c.expirationDate);
        }

        valid.push(cookie);
      }

      this.cachedCookies = valid;
      log.info(`[CookieManager] Successfully loaded ${valid.length} Google cookies from: ${foundPath}`);
      return valid;
    } catch (err: any) {
      log.warning(`[CookieManager] Failed to parse ${foundPath}: ${err.message}`);
      this.cachedCookies = [];
      return [];
    }
  }

  /**
   * Inject loaded Google session cookies into a Playwright browser context
   */
  public async injectCookies(context: BrowserContext): Promise<number> {
    const cookies = this.loadCookies();
    if (cookies.length === 0) {
      return 0;
    }

    try {
      await context.addCookies(cookies);
      return cookies.length;
    } catch (err: any) {
      log.warning(`[CookieManager] Error injecting cookies into context: ${err.message}`);
      // Fallback: try injecting cookies individually if batch failed
      let succeeded = 0;
      for (const cookie of cookies) {
        try {
          await context.addCookies([cookie]);
          succeeded++;
        } catch {
          // Skip invalid single cookie
        }
      }
      return succeeded;
    }
  }

  /**
   * Check if authenticated cookies are available
   */
  public hasCookies(): boolean {
    return this.loadCookies().length > 0;
  }
}

export const cookieManager = new CookieManager();

