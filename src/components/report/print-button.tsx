"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        console.log("PRINT CLICKED");
        window.print();
      }}
      className="inline-flex items-center rounded-md bg-[#3560AD] px-4 py-2 text-sm font-medium text-white hover:bg-[#2d4f8f]"
    >
      Print
    </button>
  );
}
