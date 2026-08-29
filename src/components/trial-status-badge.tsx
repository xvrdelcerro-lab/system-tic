'use client';

import { useState } from 'react';
import { useTrialStatus } from '@/hooks/use-trial-status';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/navigation';
import { Clock, Crown, AlertCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function TrialStatusBadge() {
  const router = useRouter();
  const { plan, trialEndsAt, daysLeft, isExpired, loading } = useTrialStatus();
  const [open, setOpen] = useState(false);

  if (loading) return null;

  // Don't show if active paid plan
  if (plan === 'active') return null;

  const handleUpgrade = () => {
    setOpen(false);
    router.push('/subscription');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={`w-full justify-start gap-3 ${
            isExpired ? 'text-red-600 hover:text-red-700' : 'text-amber-600 hover:text-amber-700'
          }`}
        >
          {isExpired ? (
            <>
              <AlertCircle className="h-5 w-5" />
              <div className="flex flex-col items-start group-data-[collapsible=icon]:hidden">
                <span className="font-semibold">Trial Expired</span>
                <span className="text-xs">Upgrade now</span>
              </div>
            </>
          ) : (
            <>
              <Clock className="h-5 w-5" />
              <div className="flex flex-col items-start group-data-[collapsible=icon]:hidden">
                <span className="font-semibold">Trial</span>
                <span className="text-xs">{daysLeft} days left</span>
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="right" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Trial Status</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan:</span>
                <span className="font-medium">Trial</span>
              </div>
              {trialEndsAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expires:</span>
                  <span className="font-medium">
                    {trialEndsAt.toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Days left:</span>
                <span className={`font-medium ${isExpired ? 'text-red-600' : ''}`}>
                  {isExpired ? 'Expired' : daysLeft}
                </span>
              </div>
            </div>
          </div>

          {isExpired && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
              Your trial has ended. Subscribe to continue using Systematic.
            </div>
          )}

          <Button 
            className="w-full" 
            onClick={handleUpgrade}
            variant={isExpired ? 'destructive' : 'default'}
          >
            <Crown className="mr-2 h-4 w-4" />
            {isExpired ? 'Subscribe Now' : 'Upgrade to Pro'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}