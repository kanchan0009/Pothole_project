import { Router, type RequestHandler } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  authForgotLimiter,
  authLoginLimiter,
  authRegisterLimiter,
  authResetLimiter,
} from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  googleLoginSchema,
} from '../validations/auth.schema.js';

export const authRoutes = Router();

/** Parses an optional avatar file when the client sends multipart/form-data. */
const optionalAvatarUpload: RequestHandler = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    upload.single('avatar')(req, res, next);
    return;
  }
  next();
};

// Public — every unauthenticated auth path is rate-limited per IP.
authRoutes.post('/register', authRegisterLimiter, validateBody(registerSchema), asyncHandler(authController.register));
authRoutes.post('/login', authLoginLimiter, validateBody(loginSchema), asyncHandler(authController.login));
authRoutes.post('/google', authLoginLimiter, validateBody(googleLoginSchema), asyncHandler(authController.googleLogin));
authRoutes.post('/refresh', validateBody(refreshSchema), asyncHandler(authController.refresh));
authRoutes.post('/logout', validateBody(logoutSchema), asyncHandler(authController.logout));
authRoutes.post(
  '/forgot-password',
  authForgotLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword)
);
authRoutes.post(
  '/reset-password',
  authResetLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(authController.resetPassword)
);

// Protected
authRoutes.get('/me', authenticateToken, asyncHandler(authController.me));
authRoutes.put(
  '/profile',
  authenticateToken,
  optionalAvatarUpload,
  validateBody(updateProfileSchema),
  asyncHandler(authController.updateProfile)
);
authRoutes.delete('/account', authenticateToken, asyncHandler(authController.deleteAccount));
