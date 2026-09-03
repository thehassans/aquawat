import express from 'express';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import { protect } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../utils/emailService.js';
import { provisionTenantApps } from '../utils/appProvisioning.js';
import { serializeAuthTenant } from '../utils/authSerialize.js';
import { emitPlatformEvent } from '../utils/platformEvents.js';
import { recordUserActivity } from '../utils/auditLogger.js';

const router = express.Router();
const parsedDatabaseQueryTimeoutMs = Number(process.env.MONGODB_QUERY_TIMEOUT_MS || 10000);
const databaseQueryTimeoutMs = Number.isFinite(parsedDatabaseQueryTimeoutMs) && parsedDatabaseQueryTimeoutMs > 0 ? parsedDatabaseQueryTimeoutMs : 10000;

const withQueryTimeout = (query) => query.maxTimeMS(databaseQueryTimeoutMs);

const isDatabaseAvailabilityError = (error) => {
  const message = String(error?.message || '').toLowerCase();

  return message.includes('buffering timed out')
    || message.includes('timed out after')
    || message.includes('server selection')
    || message.includes('ecconnrefused')
    || message.includes('not connected')
    || message.includes('initial connection')
    || message.includes('topology is closed')
    || message.includes('client must be connected');
};

const sendRouteError = (res, error) => {
  if (isDatabaseAvailabilityError(error)) {
    return res.status(503).json({ error: 'Authentication service is temporarily unavailable. Please try again in a moment.' });
  }

  return res.status(500).json({ error: error.message });
};

const generateToken = (id, tenantId = null, expiresIn) => {
  const payload = { id: String(id) };
  if (tenantId) payload.tenantId = String(tenantId);
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: expiresIn || process.env.JWT_EXPIRE || '24h'
  });
};

const AUTH_COOKIE = 'maqder_token';
const REMEMBER_EXPIRE = process.env.JWT_REMEMBER_EXPIRE || '30d';

/** Convert JWT_EXPIRE-style strings (e.g. 7d, 24h, 30m) to milliseconds for cookie maxAge. */
const jwtExpireToMs = (expire = '7d') => {
  const match = String(expire).trim().match(/^(\d+)\s*([smhd])$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (mult[unit] || mult.d);
};

const setAuthCookie = (res, token, { rememberMe = false } = {}) => {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
  if (rememberMe) {
    options.maxAge = jwtExpireToMs(REMEMBER_EXPIRE);
  }
  res.cookie(AUTH_COOKIE, token, options);
};

const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
};

const authTenantSelect = 'name slug businessType businessTypes business settings branding subscription isActive isDemo demoTrialEndsAt demoUpgraded terminationNotice zatca nbr accountingFirmMode accountingFirmTenantId';

const demoLoginAllowed = () => {
  if (process.env.ALLOW_DEMO_LOGIN === 'true') return true;
  if (process.env.ALLOW_DEMO_LOGIN === 'false') return false;
  return process.env.NODE_ENV !== 'production';
};

const demoLoginPassword = () => {
  const fromEnv = String(process.env.DEMO_LOGIN_PASSWORD || '').trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== 'production') return 'password123';
  return '';
};

// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, tenantSlug } = req.body;
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const normalizedTenantSlug = String(tenantSlug || '').trim().toLowerCase();

    // Open registration without a tenant creates a tenantless admin — disabled by default.
    if (!normalizedTenantSlug) {
      const allowOpen = process.env.ALLOW_OPEN_REGISTER === 'true' && process.env.NODE_ENV !== 'production';
      if (!allowOpen) {
        return res.status(403).json({ error: 'Registration requires a valid tenant invite or slug' });
      }
    }
    
    let tenant = null;
    if (normalizedTenantSlug) {
      tenant = await withQueryTimeout(Tenant.findOne({ slug: normalizedTenantSlug, isActive: true }));
      if (!tenant) {
        return res.status(400).json({ error: 'Invalid tenant' });
      }
    }
    
    const existingUser = await withQueryTimeout(User.findOne({ 
      email: normalizedEmail, 
      tenantId: tenant?._id || null 
    }));
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    if (!tenant) {
      return res.status(400).json({ error: 'tenantSlug is required' });
    }
    
    const user = await User.create({
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      tenantId: tenant._id,
      role: 'viewer'
    });
    
    const token = generateToken(user._id, user.tenantId);
    setAuthCookie(res, token);

    emitPlatformEvent('sign_up', {
      userId: String(user._id),
      tenantId: user.tenantId ? String(user.tenantId) : undefined,
    });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId
      }
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    let { email, password, isObfuscated, tenantSlug, rememberMe } = req.body;
    
    // Obfuscation decode to prevent plaintext in browser payload
    if (isObfuscated && password) {
      password = decodeURIComponent(Buffer.from(password, 'base64').toString('utf-8'));
    }

    const normalizedEmail = String(email || '').toLowerCase().trim();
    const normalizedTenantSlug = String(tenantSlug || '').trim().toLowerCase();
    
    let query = { email: normalizedEmail };
    let user = null;
    let tenant = null;
    let passwordAlreadyVerified = false;
    
    if (normalizedTenantSlug) {
      // Login with specific tenant
      tenant = await withQueryTimeout(Tenant.findOne({ slug: normalizedTenantSlug }).select(authTenantSelect));
      if (!tenant) {
        return res.status(404).json({ error: 'Account does not exist', code: 'account_not_found' });
      }
      // Always set tenantId for user lookup regardless of active status.
      // If inactive, we still issue a token — the frontend InactiveBlocker handles it.
      query.tenantId = tenant._id;
    } else {
      const matchingUsers = await withQueryTimeout(User.find({ email: normalizedEmail }).select('+password'));

      if (matchingUsers.length === 0) {
        // No users found at all — fall through to the account_not_found check below
      } else if (matchingUsers.length === 1) {
        user = matchingUsers[0];
      } else {
        // Multiple users share this email across tenants.
        // Try to find one whose password matches.
        // Group by password hash to prevent thread pool exhaustion and redundant bcrypt operations.
        const hashGroups = new Map();
        for (const candidate of matchingUsers) {
          const hash = candidate.password;
          if (!hashGroups.has(hash)) {
            hashGroups.set(hash, []);
          }
          hashGroups.get(hash).push(candidate);
        }

        const passwordMatches = [];
        for (const [hash, candidates] of hashGroups.entries()) {
          // We only check each unique hash once, which saves significant CPU if hashes match.
          // Doing this sequentially also prevents starving the Node.js event loop.
          const isMatch = await candidates[0].comparePassword(password);
          if (isMatch) {
            passwordMatches.push(...candidates);
          }
        }

        if (passwordMatches.length === 1) {
          user = passwordMatches[0];
          passwordAlreadyVerified = true;
        } else if (passwordMatches.length > 1) {
          // Multiple matches — prefer super_admin or non-tenant user, otherwise fallback to the first active account
          const preferredMatch = passwordMatches.find((c) => c.role === 'super_admin')
            || passwordMatches.find((c) => !c.tenantId)
            || passwordMatches.find((c) => c.isActive)
            || passwordMatches[0];

          user = preferredMatch;
          passwordAlreadyVerified = true;
        } else {
          // No password match among multiple users — return invalid credentials immediately.
          // Do NOT fall back to guessing by role; that would allow wrong-tenant login attempts.
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      }
    }
    
    // If tenant slug was provided, find user with that query
    if (normalizedTenantSlug && !user) {
      user = await withQueryTimeout(User.findOne(query).select('+password'));
    }
    
    if (!user) {
      const expectedDemoPassword = demoLoginPassword();
      if (demoLoginAllowed() && expectedDemoPassword && normalizedEmail.endsWith('@test.com') && password === expectedDemoPassword) {
        const businessType = normalizedEmail.split('@')[0];
        
        tenant = await Tenant.create({
          name: `Demo ${businessType.charAt(0).toUpperCase() + businessType.slice(1)}`,
          slug: `demo-${businessType}-${Date.now().toString().slice(-6)}`,
          businessType: businessType,
          businessTypes: [businessType],
        });

        await provisionTenantApps(tenant, { save: true });

        user = await User.create({
          email: normalizedEmail,
          password: expectedDemoPassword,
          firstName: 'Demo',
          lastName: 'User',
          tenantId: tenant._id,
          role: 'admin',
          isActive: true
        });
        
        passwordAlreadyVerified = true;
      } else {
        return res.status(404).json({ error: 'Account does not exist', code: 'account_not_found' });
      }
    }
    
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    if (user.tenantId) {
      tenant = tenant || await withQueryTimeout(Tenant.findById(user.tenantId).select(authTenantSelect));
      if (!tenant) {
        return res.status(401).json({ error: 'Tenant account is inactive' });
      }
      // If tenant is inactive, we still issue the token — the frontend InactiveBlocker handles it
    }

    // If a previous lock has expired, clear it so the user isn't immediately re-locked
    const now = Date.now();
    const hadExpiredLock = Boolean(user.lockUntil && user.lockUntil <= now);

    if (hadExpiredLock) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
    }
    
    if (user.lockUntil && user.lockUntil > now) {
      const retryAfterMs = user.lockUntil - now;
      const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
      return res.status(401).json({
        error: `Account is temporarily locked. Try again in about ${retryAfterMinutes} minute(s).`,
        code: 'ACCOUNT_LOCKED',
        retryAfterMinutes,
        lockUntil: user.lockUntil,
      });
    }
    
    const isMatch = passwordAlreadyVerified ? true : await user.comparePassword(password);
    
    if (!isMatch) {
      const failedLoginAttempts = (user.loginAttempts || 0) + 1;
      const failedUpdate = {
        $set: {
          loginAttempts: failedLoginAttempts,
        },
      };

      // Lock after 5 failures for 15 minutes (was 30)
      if (failedLoginAttempts >= 5) {
        failedUpdate.$set.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      } else if (hadExpiredLock) {
        failedUpdate.$unset = { lockUntil: 1 };
      }

      await withQueryTimeout(User.updateOne({ _id: user._id }, failedUpdate));
      const remaining = Math.max(0, 5 - failedLoginAttempts);
      return res.status(401).json({
        error: remaining > 0
          ? `Invalid credentials (${remaining} attempt(s) left before lock)`
          : 'Invalid credentials. Account locked for 15 minutes.',
        code: remaining > 0 ? 'INVALID_CREDENTIALS' : 'ACCOUNT_LOCKED',
        attemptsRemaining: remaining,
      });
    }
    
    // Reset login attempts on successful login — fire-and-forget so the response
    // is not blocked by an extra DB round-trip.
    const updatePayload = {
      $set: { loginAttempts: 0, lastLogin: new Date() },
      $unset: { lockUntil: 1 },
    };

    // Auto-migrate legacy cost factor 12 hashes to cost factor 10
    if (user.password && (user.password.startsWith('$2a$12$') || user.password.startsWith('$2b$12$'))) {
      const bcrypt = (await import('bcryptjs')).default;
      updatePayload.$set.password = await bcrypt.hash(password, 10);
    }

    User.updateOne({ _id: user._id }, updatePayload).catch(() => {});

    const remember = rememberMe === true || rememberMe === 'true' || rememberMe === 1 || rememberMe === '1';
    const token = generateToken(user._id, user.tenantId || tenant?._id, remember ? REMEMBER_EXPIRE : undefined);
    const responseTenant = serializeAuthTenant(tenant);
    setAuthCookie(res, token, { rememberMe: remember });

    emitPlatformEvent('login', {
      userId: String(user._id),
      tenantId: user.tenantId ? String(user.tenantId) : (tenant?._id ? String(tenant._id) : undefined),
    });

    recordUserActivity(req, {
      action: 'login',
      module: 'auth',
      resourceType: 'User',
      resourceId: user._id,
      resourceName: `${user.firstName || ''} ${user.lastName || ''} (${user.email})`.trim(),
      description: `User logged into system`,
      descriptionAr: `تسجيل دخول ناجح إلى النظام`,
      userId: user._id,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      userEmail: user.email,
      userRole: user.role,
      tenantId: user.tenantId || tenant?._id,
    }).catch(() => {});

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        firstNameAr: user.firstNameAr,
        lastNameAr: user.lastNameAr,
        role: user.role,
        tenantId: user.tenantId,
        branchId: user.branchId,
        permissions: user.permissions,
        preferences: user.preferences,
        avatar: user.avatar,
        firmHomeTenantId: user.firmHomeTenantId || null,
        accessibleTenantIds: user.accessibleTenantIds || [],
      },
      tenant: responseTenant
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    // `protect` has already loaded the user (and tenant for non-super-admins).
    // Reuse those documents instead of issuing two more round-trips.
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const requestedTenantId = user.role === 'super_admin'
      ? (user.tenantId || req.headers['x-tenant-id'] || null)
      : (user.tenantId || null);

    let tenant = null;
    if (requestedTenantId) {
      // Always load the full auth projection. Reusing protect's slim cached
      // tenant dropped business (CR/VAT) and caused empty company profiles.
      const foundTenant = await withQueryTimeout(Tenant.findById(requestedTenantId).select(authTenantSelect).lean());
      if (foundTenant) {
        tenant = serializeAuthTenant(foundTenant);
      }
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        firstNameAr: user.firstNameAr,
        lastNameAr: user.lastNameAr,
        role: user.role,
        branchId: user.branchId,
        permissions: user.permissions,
        preferences: user.preferences,
        avatar: user.avatar,
        tenantId: user.tenantId || null,
        firmHomeTenantId: user.firmHomeTenantId || null,
        accessibleTenantIds: user.accessibleTenantIds || [],
      },
      tenant
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   PUT /api/auth/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { firstName, lastName, firstNameAr, lastNameAr, phone, preferences } = req.body;
    
    const user = await withQueryTimeout(User.findByIdAndUpdate(
      req.user._id,
      { firstName, lastName, firstNameAr, lastNameAr, phone, preferences },
      { new: true, runValidators: true }
    ));
    
    res.json({ user });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   PUT /api/auth/password
router.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await withQueryTimeout(User.findById(req.user._id).select('+password'));
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await withQueryTimeout(User.findOne({ email: normalizedEmail }));

    if (!user) {
      return res.status(200).json({ message: 'If that email exists in our system, we have sent a password reset link.' });
    }

    let personalEmail = undefined;
    if (user.tenantId) {
      const tenant = await withQueryTimeout(Tenant.findById(user.tenantId));
      if (tenant && tenant.personalEmail) {
        personalEmail = tenant.personalEmail;
      }
    }

    const resetToken = randomBytes(32).toString('hex');
    user.passwordResetToken = createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    const baseUrl = req.get('origin') || process.env.CLIENT_URL || 'https://maqder.com';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    const emailResult = await sendPasswordResetEmail({ user, resetUrl, personalEmail });

    if (!emailResult.sent) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ error: 'There was an error sending the email. Try again later.' });
    }

    res.status(200).json({ message: 'If that email exists in our system, we have sent a password reset link.' });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   POST /api/auth/reset-password/:token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const hashedToken = createHash('sha256').update(req.params.token).digest('hex');

    const user = await withQueryTimeout(User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }));

    if (!user) {
      return res.status(400).json({ error: 'Token is invalid or has expired' });
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   POST /api/auth/login-phone
router.post('/login-phone', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });

    const user = await withQueryTimeout(User.findOne({ phone }));
    if (!user) return res.status(404).json({ error: 'User not found with this phone number' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const bcrypt = (await import('bcryptjs')).default;
    user.otp = await bcrypt.hash(otp, 10);
    user.otpExpires = Date.now() + 5 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const { sendOTP } = await import('../utils/smsService.js');
    await sendOTP(phone, otp);

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

    const user = await withQueryTimeout(User.findOne({ phone, otpExpires: { $gt: Date.now() } }).select('+otp'));
    if (!user || !user.otp) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const bcrypt = (await import('bcryptjs')).default;
    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) return res.status(400).json({ error: 'Invalid or expired OTP' });

    user.otp = undefined;
    user.otpExpires = undefined;
    if (!user.phoneVerified) user.phoneVerified = true;
    await user.save({ validateBeforeSave: false });

    let tenant = null;
    if (user.tenantId) {
      tenant = await withQueryTimeout(Tenant.findById(user.tenantId).select(authTenantSelect));
    }

    const remember = req.body?.rememberMe === true || req.body?.rememberMe === 'true' || req.body?.rememberMe === 1 || req.body?.rememberMe === '1';
    const token = generateToken(user._id, user.tenantId || tenant?._id, remember ? REMEMBER_EXPIRE : undefined);
    const responseTenant = serializeAuthTenant(tenant);
    setAuthCookie(res, token, { rememberMe: remember });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        firstNameAr: user.firstNameAr,
        lastNameAr: user.lastNameAr,
        role: user.role,
        branchId: user.branchId,
        permissions: user.permissions,
        preferences: user.preferences,
        avatar: user.avatar
      },
      tenant: responseTenant
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   POST /api/auth/forgot-password-phone
router.post('/forgot-password-phone', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });

    const user = await withQueryTimeout(User.findOne({ phone }));
    if (!user) return res.status(200).json({ message: 'If that phone exists in our system, we have sent an OTP.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const bcrypt = (await import('bcryptjs')).default;
    user.otp = await bcrypt.hash(otp, 10);
    user.otpExpires = Date.now() + 5 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const { sendOTP } = await import('../utils/smsService.js');
    await sendOTP(phone, otp);

    res.status(200).json({ message: 'If that phone exists in our system, we have sent an OTP.' });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   POST /api/auth/reset-password-phone
router.post('/reset-password-phone', async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body;
    if (!phone || !otp || !newPassword) return res.status(400).json({ error: 'Phone, OTP, and newPassword are required' });

    const user = await withQueryTimeout(User.findOne({ phone, otpExpires: { $gt: Date.now() } }).select('+otp'));
    if (!user || !user.otp) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const bcrypt = (await import('bcryptjs')).default;
    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) return res.status(400).json({ error: 'Invalid or expired OTP' });

    user.password = newPassword; // The pre-save hook will hash this new password
    user.otp = undefined;
    user.otpExpires = undefined;
    if (!user.phoneVerified) user.phoneVerified = true;
    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    sendRouteError(res, error);
  }
});

// @route   POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
});

/**
 * Issue a one-time cross-subdomain handoff code (2 min TTL).
 * Prefer this over putting JWTs in URL hashes.
 */
router.post('/handoff/issue', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token is required' });
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }
    jwt.verify(token, process.env.JWT_SECRET);
    const { issueHandoffCode } = await import('../utils/handoffCodes.js');
    const code = await issueHandoffCode(token);
    res.json({ code, expiresIn: 120 });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    sendRouteError(res, error);
  }
});

/**
 * Exchange a one-time handoff code for a session (cookie + token body for desktop).
 */
router.post('/handoff/exchange', async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim();
    if (!code) return res.status(400).json({ error: 'code is required' });

    const { consumeHandoffCode } = await import('../utils/handoffCodes.js');
    const token = await consumeHandoffCode(code);
    if (!token) return res.status(401).json({ error: 'Invalid or expired handoff code' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await withQueryTimeout(User.findById(decoded.id).select('-password'));
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found' });
    }

    let tenant = null;
    if (user.tenantId) {
      tenant = await withQueryTimeout(Tenant.findById(user.tenantId).select(authTenantSelect));
    }

    setAuthCookie(res, token);
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        firstNameAr: user.firstNameAr,
        lastNameAr: user.lastNameAr,
        role: user.role,
        tenantId: user.tenantId,
        branchId: user.branchId,
        permissions: user.permissions,
        preferences: user.preferences,
        avatar: user.avatar,
      },
      tenant: serializeAuthTenant(tenant),
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired handoff session' });
    }
    sendRouteError(res, error);
  }
});

export default router;
