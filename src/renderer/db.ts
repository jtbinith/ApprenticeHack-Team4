// Local-first storage (IndexedDB via Dexie). Nothing leaves the device.
//
// Usage from any feature:
//   import { db } from './db';
//   await db.activities.add({...});
//   liveQuery(() => db.otjSessions.toArray()).subscribe(render);

import Dexie, { type EntityTable } from 'dexie';
import type {
  Activity,
  FormTemplate,
  OtjSession,
  Reflection,
  Review,
  Settings,
  Standard,
} from '../shared/types';
import { seed } from './seed';

export class CanopyDb extends Dexie {
  standards!: EntityTable<Standard, 'id'>;
  activities!: EntityTable<Activity, 'id'>;
  reflections!: EntityTable<Reflection, 'id'>;
  otjSessions!: EntityTable<OtjSession, 'id'>;
  reviews!: EntityTable<Review, 'id'>;
  formTemplates!: EntityTable<FormTemplate, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor() {
    super('canopy');
    // Only indexed fields are listed; other properties are stored as-is.
    this.version(1).stores({
      standards: 'id',
      activities: 'id, start, kind',
      reflections: 'id, date, activityId, portalStatus, *ksbs',
      otjSessions: 'id, endedAt, category',
      reviews: 'id, date',
      formTemplates: 'id',
      settings: 'id',
    });
  }
}

export const db = new CanopyDb();

/** Fill an empty database with demo data so every feature has something to show. */
export async function seedIfEmpty(): Promise<void> {
  if ((await db.settings.count()) > 0) return;
  const data = seed();
  await db.transaction('rw', db.tables, async () => {
    await db.settings.put(data.settings);
    await db.standards.bulkPut(data.standards);
    await db.activities.bulkPut(data.activities);
    await db.reflections.bulkPut(data.reflections);
    await db.otjSessions.bulkPut(data.otjSessions);
    await db.reviews.bulkPut(data.reviews);
  });
}

/** Wipe all local data (backs "Delete all" in Connectors & privacy, #60). */
export async function deleteAllData(): Promise<void> {
  await db.delete();
  await db.open();
}

export function newId(): string {
  return crypto.randomUUID();
}
