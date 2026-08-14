import { z } from 'zod';


export const passwordRule = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Z]/, 'An uppercase letter is required')
  .regex(/[a-z]/, 'A lowercase letter is required')
  .regex(/[0-9]/, 'A number is required')
  .regex(/[^A-Za-z0-9]/, 'A special character is required');
