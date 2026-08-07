/**
 * Zod schema for the Create Version dialog.
 *
 * Mirrors the backend `VersionRequest` ([BCR §5.5]): `change_reason` is
 * required, 1–500 chars, stored trimmed (backend 422 on empty).
 */
import { z } from 'zod';

export const versionFormSchema = z.object({
  change_reason: z
    .string()
    .trim()
    .min(1, 'Change reason is required')
    .max(500, 'Change reason must be at most 500 characters'),
});

export type VersionFormValues = z.infer<typeof versionFormSchema>;

export const defaultVersionFormValues: VersionFormValues = { change_reason: '' };
