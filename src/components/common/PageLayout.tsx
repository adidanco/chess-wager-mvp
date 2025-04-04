import React, { ReactNode } from "react";
import Navigation from "./Navigation";
import Footer from "./Footer";
import { Box, Container } from "@mui/material";

/**
 * Props interface for PageLayout component
 */
interface PageLayoutProps {
  children: ReactNode;
  centered?: boolean;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
  hideNav?: boolean;
  hideFooter?: boolean;
}

/**
 * Common page layout component for consistent page structure
 * Updated to support both Tailwind CSS and MUI based on props with Gam(e)Bit theming
 */
const PageLayout = ({ 
  children, 
  centered = false, 
  maxWidth = "lg",
  hideNav = false,
  hideFooter = false
}: PageLayoutProps): JSX.Element => {
  // Dual support for Tailwind and MUI
  // If MUI components are passed as children, they'll use the Container
  // If Tailwind components are passed, they'll use the div with className
  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      {!hideNav && <Navigation />}
      <Box 
        sx={{ 
          flexGrow: 1, 
          p: { xs: 2, md: 4 }, 
          pt: 2,
          backgroundColor: '#FEF3FF' // off-white from our theme
        }}
      >
        <Container maxWidth={maxWidth}>
          {centered ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: hideNav && hideFooter ? '100vh' : 'inherit'
            }}>
              {children}
            </Box>
          ) : (
            children
          )}
        </Container>
      </Box>
      {!hideFooter && <Footer />}
    </div>
  );
};

export default PageLayout; 