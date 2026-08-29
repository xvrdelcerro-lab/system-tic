'use client'


import { useSubscription } from "@/hooks/use-subscription"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function BillingPage() {
  const { isActive } = useSubscription()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Billing & Subscription
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Subscription Status</CardTitle>
          <CardDescription>
            Manage your membership and billing details.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-sm">
            Status:&nbsp;
            <span
              className={
                isActive
                  ? "font-semibold text-green-600"
                  : "font-semibold text-red-600"
              }
            >
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>

          {!isActive && (
            <Button onClick={() => alert("Payment flow coming soon")}>
              Activate Subscription
            </Button>
          )}

          {isActive && (
            <div className="text-sm text-muted-foreground">
              Your subscription is active. Thank you!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
