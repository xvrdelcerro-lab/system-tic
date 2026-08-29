'use client';

import { useState } from 'react';

/**
 * Mock subscription hook. 
 * In a real application, this would check a backend service to determine
 * if the user has an active subscription.
 */
export function useSubscription() {
  // For now, we'll assume the user has an active subscription to enable all features.
  const [isActive] = useState(true);

  return { isActive };
}
