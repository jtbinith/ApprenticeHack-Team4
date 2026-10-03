import type { Ksb } from '../../../../shared/types';

/** Compact KSB constructor for the bundled standards. */
export function k(
  code: string,
  type: Ksb['type'],
  title: string,
  keywords: string[],
  detail?: string,
): Ksb {
  return { code, type, title, keywords, ...(detail ? { detail } : {}) };
}
