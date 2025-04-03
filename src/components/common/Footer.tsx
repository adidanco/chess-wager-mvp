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
        backgroundColor: "white",
        borderTop: "1px solid",
        borderColor: "divider"
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Link 
            component={RouterLink} 
            to="/contact-us" 
            color="text.secondary" 
            sx={{ mx: 2, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
          >
            Contact Us
          </Link>
          <Link 
            component={RouterLink} 
            to="/terms-and-conditions" 
            color="text.secondary" 
            sx={{ mx: 2, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
          >
            Terms & Conditions
          </Link>
        </Box>
        <Typography variant="body2" color="text.secondary" align="center">
          © {currentYear} Chess Wager. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
};

export default Footer;
