import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const cookieName = 'pe4u_admin';
const sessionHours = 12;
const loginAttempts = new Map<string, { count: number; first: number }>();

function configuredPassword() {
  return process.env.ADMIN_PASSWORD || '';
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET || configuredPassword();
  return secret ? createHash('sha256').update(secret).digest() : null;
}

function sign(body: string, secret: Buffer) {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function validSession(token: string | undefined) {
  const secret = sessionSecret();
  if (!secret || !token) return false;

  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) return false;

  const expected = Buffer.from(sign(body, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function adminConfigured() {
  return Boolean(configuredPassword());
}

export function isAdminAuthenticated(request: NextRequest) {
  return validSession(request.cookies.get(cookieName)?.value);
}

export function requireAdmin(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });
  }
  if (request.headers.get('x-requested-with') !== 'pe4u') {
    return NextResponse.json({ error: 'Blocked request.' }, { status: 403 });
  }
  return null;
}

export function loginAllowed(ip: string) {
  const attempt = loginAttempts.get(ip);
  if (!attempt) return true;
  if (Date.now() - attempt.first >= 15 * 60 * 1000) {
    loginAttempts.delete(ip);
    return true;
  }
  return attempt.count < 5;
}

export function recordLoginFailure(ip: string) {
  const attempt = loginAttempts.get(ip);
  if (!attempt || Date.now() - attempt.first >= 15 * 60 * 1000) {
    loginAttempts.set(ip, { count: 1, first: Date.now() });
  } else {
    attempt.count += 1;
  }
}

export function clearLoginFailures(ip: string) {
  loginAttempts.delete(ip);
}

export function verifyAdminPassword(candidate: string) {
  const password = configuredPassword();
  const candidateHash = createHash('sha256').update(candidate).digest();
  const passwordHash = createHash('sha256').update(password || 'unconfigured').digest();
  return Boolean(password) && timingSafeEqual(candidateHash, passwordHash);
}

export function createAdminSession() {
  const secret = sessionSecret();
  if (!secret) throw new Error('Admin password is not configured.');
  const body = Buffer.from(JSON.stringify({ exp: Date.now() + sessionHours * 3600 * 1000 })).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export const adminCookie = cookieName;
export const adminSessionMaxAge = sessionHours * 60 * 60;