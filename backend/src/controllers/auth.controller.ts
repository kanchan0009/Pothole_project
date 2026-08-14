import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';


export const authController = {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result });
  },

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  },

  async googleLogin(req: Request, res: Response) {
    const result = await authService.googleLogin(req.body.token);
    res.json({ success: true, data: result });
  },

  async refresh(req: Request, res: Response) {
    const result = await authService.refresh(req.body.refreshToken);
    res.json({ success: true, data: result });
  },

  async logout(req: Request, res: Response) {
    await authService.logout(req.body.refreshToken);
    res.json({ success: true, message: 'Logged out successfully' });
  },

  async forgotPassword(req: Request, res: Response) {
    await authService.forgotPassword(req.body.email);
    res.json({
      success: true,
      message: 'If that email is registered, a password reset link has been sent.',
    });
  },

  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ success: true, message: 'Password has been reset. You can now log in.' });
  },

  async me(req: Request, res: Response) {
    const user = await authService.getProfile(req.user!.id);
    res.json({ success: true, data: { user } });
  },

  async updateProfile(req: Request, res: Response) {
    const user = await authService.updateProfile(req.user!.id, req.body, req.file);
    res.json({ success: true, message: 'Profile updated', data: { user } });
  },

  async deleteAccount(req: Request, res: Response) {
    await authService.deleteAccount(req.user!.id);
    res.json({ success: true, message: 'Your account has been deactivated.' });
  },
};
