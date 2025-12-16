import { getRedisClient } from "./redis.js";
import type { Context, Next } from "hono";

// Valid vote values for Fibonacci sequence
const VALID_VOTES = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?", "☕"];

// Validation functions
export function isValidVote(value: unknown): boolean {
  return VALID_VOTES.includes(value as never) || value === null;
}

export function isValidName(name: unknown): boolean {
  if (typeof name !== "string") return false;
  return name.length > 0 && name.length <= 50;
}

export function isValidRoomCode(code: unknown): boolean {
  if (typeof code !== "string") return false;
  return /^[A-Z0-9]{6}$/.test(code);
}

// Rate limiting using Redis
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute

export async function rateLimiter(c: Context, next: Next) {
  // Skip rate limiting in development/test environments
  if (process.env.NODE_ENV !== "production") {
    await next();
    return;
  }

  const redis = getRedisClient();
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const key = `rate_limit:${ip}`;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      // Set expiry on first request
      await redis.pexpire(key, RATE_LIMIT_WINDOW);
    }

    if (current > MAX_REQUESTS_PER_WINDOW) {
      return c.json({ error: "Too many requests" }, 429);
    }

    await next();
  } catch (error) {
    console.error("Rate limiter error:", error);
    // Fail open - allow request if Redis is down
    await next();
  }
}

// Body size limiter middleware
const MAX_BODY_SIZE = 1024; // 1KB
export async function bodySizeLimiter(c: Context, next: Next) {
  const contentLength = c.req.header("content-length");

  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    return c.json({ error: "Payload too large" }, 413);
  }

  await next();
}

// Security headers middleware
export async function securityHeaders(c: Context, next: Next) {
  await next();

  c.header("X-Frame-Options", "DENY");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // Skip CSP for Swagger UI docs page (needs inline scripts and styles)
  const isDocsPage = c.req.path === "/api/docs";

  // Content Security Policy (production only, except for docs page)
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && !isDocsPage) {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'", // Tailwind needs unsafe-inline
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "worker-src 'self' blob:", // Required for canvas-confetti animation
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    c.header("Content-Security-Policy", csp);
  }
}
