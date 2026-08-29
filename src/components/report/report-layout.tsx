type ReportLayoutProps = {
    title: string;
    subtitle?: string;
    meta?: string;
    orientation?: "portrait" | "landscape";
    children: React.ReactNode;
  };
  
  export function ReportLayout({
    title,
    subtitle,
    meta,
    orientation = "portrait",
    children,
  }: ReportLayoutProps) {
    return (
      <div
        className={[
          "mx-auto bg-white",
          orientation === "portrait"
            ? "w-[8.5in] min-h-[11in]"
            : "w-[11in] min-h-[8.5in]",
          "px-8 py-6",
        ].join(" ")}
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            {title}
          </h1>
  
          {subtitle && (
            <p className="mt-1 text-sm text-gray-600">
              {subtitle}
            </p>
          )}
  
          {meta && (
            <p className="mt-1 text-xs text-gray-400">
              {meta}
            </p>
          )}
        </div>
  
        {children}
      </div>
    );
  }
  