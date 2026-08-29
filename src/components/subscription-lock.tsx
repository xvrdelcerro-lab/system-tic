"use client"

import { ReactNode } from "react"
import { useSubscription } from "@/hooks/use-subscription"

interface SubscriptionLockProps {
  children: ReactNode
}

export function SubscriptionLock({ children }: SubscriptionLockProps) {
  const { isActive } = useSubscription()

  if (isActive) {
    return <>{children}</>
  }

  return (
    <div className="opacity-60 pointer-events-none">
      {children}
    </div>
  )
}
