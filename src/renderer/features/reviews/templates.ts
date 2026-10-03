// Pre-review form templates (#57). Providers' forms differ, so the apprentice
// can rename, add or remove fields; fields with a `source` can be auto-filled.

import type { FormTemplate } from '../../../shared/types';
import { db } from '../../db';

export const DEFAULT_TEMPLATE: FormTemplate = {
  id: 'default-progress-review',
  provider: 'Progress review (general)',
  fields: [
    {
      key: 'progress',
      label: 'Progress since your last review',
      source: 'progress',
    },
    { key: 'ksbs', label: 'KSBs evidenced and gaps', source: 'ksbs' },
    { key: 'otj', label: 'Off-the-job hours', source: 'otj' },
    {
      key: 'targets',
      label: 'Targets from your last review',
      source: 'targets',
    },
    {
      key: 'evidence',
      label: 'Evidence status in the portal',
      source: 'evidence',
    },
    { key: 'support', label: 'Support you need' },
    { key: 'wellbeing', label: 'Wellbeing and workload' },
  ],
};

/** The template for a review, falling back to (and saving) the default one. */
export async function templateFor(templateId?: string): Promise<FormTemplate> {
  const found = templateId ? await db.formTemplates.get(templateId) : undefined;
  if (found) return found;
  const stored = await db.formTemplates.get(DEFAULT_TEMPLATE.id);
  if (stored) return stored;
  await db.formTemplates.put(DEFAULT_TEMPLATE);
  return structuredClone(DEFAULT_TEMPLATE);
}
