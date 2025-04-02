import React, { ReactNode } from "react";
import Navigation from "./Navigation";
import { Box, Container, Typography, Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

/**
 * Props interface for PageLayout component
 */
interface PageLayoutProps {
  children: ReactNode;
  centered?: boolean;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
}

/**
 * Common page layout component for consistent page structure
 * Updated to support both Tailwind CSS and MUI based on props
 */
const PageLayout = ({ 
  children, 
  centered = false, 
  maxWidth = "lg" 
}: PageLayoutProps): JSX.Element => {
  // Dual support for Tailwind and MUI
  // If MUI components are passed as children, they'll use the Container
  // If Tailwind components are passed, they'll use the div with className
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navigation />
      <Box sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, pt: 2 }}>
        <Container maxWidth={maxWidth}>
          {centered ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {children}
            </Box>
          ) : (
            children
          )}
        </Container>
      </Box>
      
      {/* Footer with legal links */}
      <Box 
        component="footer" 
        sx={{ 
          py: 3, 
          px: 2, 
          mt: 'auto',
          backgroundColor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 3 }}>
            <Link component={RouterLink} to="/ContactUs" color="text.secondary" underline="hover">
              Contact Us
            </Link>
            <Link component={RouterLink} to="/TermsAndConditions" color="text.secondary" underline="hover">
              Terms & Conditions
            </Link>
          </Box>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
            &copy; {new Date().getFullYear()} Chess Wager. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </div>
  );
};

export default PageLayout; 