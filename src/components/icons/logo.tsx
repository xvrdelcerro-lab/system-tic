import * as React from 'react';

export function Logo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="32" height="32" rx="8" fill="hsl(var(--primary))" />
      <path
        d="M9 10C9 9.44772 9.44772 9 10 9H15.5858C15.851 9 16.1054 9.10536 16.2929 9.29289L19.7071 12.7071C19.8946 12.8946 20 13.149 20 13.4142V22C20 22.5523 19.5523 23 19 23H10C9.44772 23 9 22.5523 9 22V10Z"
        fill="hsl(var(--muted))"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M23 10C23 9.44772 22.5523 9 22 9H16.4142C16.149 9 15.8946 9.10536 15.7071 9.29289L12.2929 12.7071C12.1054 12.8946 12 13.149 12 13.4142V22C12 22.5523 12.4477 23 13 23H22C22.5523 23 23 22.5523 23 22V10Z"
        fill="hsl(var(--muted))"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fillOpacity="0.5"
      />
    </svg>
  );
}
