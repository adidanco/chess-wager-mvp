import React from "react";

/**
 * Common page layout component for consistent page structure
 */
const PageLayout = ({ children, centered = false, width = "max-w-4xl" }) => {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className={`${width} mx-auto`}>
        {centered ? (
          <div className="flex flex-col items-center justify-center min-h-screen">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default PageLayout; 