import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number with commas as thousand separators.
 * @param num The number to format.
 * @returns A string with the formatted number.
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Formats a number as currency.
 * @param amount The number to format.
 * @param options Options for formatting.
 * @returns A string with the formatted currency.
 */
export function formatCurrency(
  amount: number, 
  options: { 
    compact?: boolean, 
    showDecimals?: boolean 
  } = { compact: false, showDecimals: true }
): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    amount = 0;
  }
  
  const formatterOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: options.showDecimals ? 2 : 0,
    maximumFractionDigits: options.showDecimals ? 2 : 0,
  };

  if (options.compact) {
    formatterOptions.notation = 'compact';
    formatterOptions.compactDisplay = 'short';
  }

  return new Intl.NumberFormat('en-US', formatterOptions).format(amount);
}
