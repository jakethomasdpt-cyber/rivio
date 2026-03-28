'use client';

import { useEffect, useState } from 'react';
import { APP_DATA_KEY, createInitialAppData } from '@/lib/app-data';
import type { AppData } from '@/types';

export function useAppData() {
  const [data, setData] = useState<AppData>(createInitialAppData);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(APP_DATA_KEY);
      if (stored) {
        setData({ ...createInitialAppData(), ...JSON.parse(stored) });
      } else {
        window.localStorage.setItem(APP_DATA_KEY, JSON.stringify(createInitialAppData()));
      }
    } catch {
      window.localStorage.removeItem(APP_DATA_KEY);
      window.localStorage.setItem(APP_DATA_KEY, JSON.stringify(createInitialAppData()));
      setData(createInitialAppData());
    } finally {
      setHydrated(true);
    }
  }, []);

  const updateData = (updater: AppData | ((current: AppData) => AppData)) => {
    setData((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      window.localStorage.setItem(APP_DATA_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { data, setData: updateData, hydrated };
}
