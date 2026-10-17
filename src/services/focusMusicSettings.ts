import {z} from 'zod';
export const focusMusicSchema=z.object({enabled:z.boolean(),volume:z.number().min(0).max(100),track:z.enum(['meditation','dream','lemon','cities']).optional()}).strict();
export type FocusMusicSettings=z.infer<typeof focusMusicSchema>;
