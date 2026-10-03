// Standards bundled with Canopy, offered in the setup wizard alongside any
// standard already saved on this device (e.g. the demo standard).

import type { Standard } from '../../../../shared/types';
import { DATA_ANALYST } from './data-analyst';
import { SOFTWARE_DEVELOPER } from './software-developer';

export const BUNDLED_STANDARDS: Standard[] = [SOFTWARE_DEVELOPER, DATA_ANALYST];

/** A fresh standard with no KSBs, for "Start blank". */
export function blankStandard(): Standard {
  return {
    id: `custom-${crypto.randomUUID()}`,
    name: 'My standard',
    ksbs: [],
  };
}
