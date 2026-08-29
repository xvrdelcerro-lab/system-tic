type ReportCardProps = {
    title?: string;
    children: React.ReactNode;
  };
  
  export function ReportCard({ title, children }: ReportCardProps) {
    return (
      <div className="border border-gray-300">
        {title && (
          <div className="border-b border-gray-300 px-4 py-2">
            <h2 className="text-sm font-medium text-gray-700">
              {title}
            </h2>
          </div>
        )}
  
        <div className="px-4 py-6">
          {children}
        </div>
      </div>
    );
  }
  