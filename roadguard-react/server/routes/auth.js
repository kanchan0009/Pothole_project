import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { authenticateToken, JWT_SECRET } from '../middleware/auth.js';

const router = express.Router();

// Register new user
router.post('/register', (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    const user = db.createUser({
      name,
      email,
      password_hash: passwordHash,
      phone: phone || null,
      avatar: defaultAvatar,
      role: 'user'
    });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar
    };

    res.status(201).json({ message: 'Registration successful', token, user: userResponse });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar
    };

    res.json({ message: 'Login successful', token, user: userResponse });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password_hash, ...userResponse } = user;
    res.json({ user: userResponse });
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update profile
router.put('/profile', authenticateToken, (req, res) => {
  const { name, phone, avatar } = req.body;

  try {
    const updatedUser = db.updateUser(req.user.id, {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(avatar && { avatar })
    });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password_hash, ...userResponse } = updatedUser;
    res.json({ message: 'Profile updated successfully', user: userResponse });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
