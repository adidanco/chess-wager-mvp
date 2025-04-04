import React from "react";
import { Box, Container, Typography, Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <Box 
      component="footer" 
      sx={{ 
        py: 3, 
        px: 2, 
        mt: "auto",
        backgroundColor: "#f0fdf4", // Light emerald background
        borderTop: "1px solid",
        borderColor: "#d1fae5" // Lighter emerald for border
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Link 
            component={RouterLink} 
            to="/contact-us" 
            color="#047857" // emerald-700 equivalent
            sx={{ mx: 2, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
          >
            Contact Us
          </Link>
          <Link 
            component={RouterLink} 
            to="/terms-and-conditions" 
            color="#047857" // emerald-700 equivalent
            sx={{ mx: 2, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
          >
            Terms & Conditions
          </Link>
        </Box>
        <Typography variant="body2" color="#065f46" align="center"> {/* emerald-800 equivalent */}
          © {currentYear} Oasis. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
};

export default Footer;
