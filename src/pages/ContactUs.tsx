import React from 'react';
import { Container, Typography, Paper, Box, Divider } from '@mui/material';
import PageLayout from '../components/common/PageLayout';

const ContactUs: React.FC = () => {
  return (
    <PageLayout>
      <Container maxWidth="md">
        <Paper elevation={3} sx={{ p: 4, my: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            Contact Us
          </Typography>
          
          <Typography variant="subtitle1" gutterBottom sx={{ color: 'text.secondary' }}>
            Last updated on 19-03-2025 15:38:14
          </Typography>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="body1" paragraph>
            You may contact us using the information below:
          </Typography>
          
          <Box sx={{ ml: 2, mb: 3 }}>
            <Typography variant="body1" paragraph>
              <strong>Merchant Legal entity name:</strong> AATITHYA HITESH VORA
            </Typography>
            
            <Typography variant="body1" paragraph>
              <strong>Registered Address:</strong> Aastha Appartment-B Block No.401,Opp SBI Bank Lane Behind Wockhardt Hospital, Rajkot Raiya Road, Gujarat, PIN: 360007
            </Typography>
            
            <Typography variant="body1" paragraph>
              <strong>Operational Address:</strong> Aastha Appartment-B Block No.401,Opp SBI Bank Lane Behind Wockhardt Hospital, Rajkot Raiya Road, Gujarat, PIN: 360007
            </Typography>
            
            <Typography variant="body1" paragraph>
              <strong>Telephone No:</strong> 7862961960
            </Typography>
            
            <Typography variant="body1" paragraph>
              <strong>E-Mail ID:</strong> aatithya.apple@gmail.com
            </Typography>
          </Box>
        </Paper>
      </Container>
    </PageLayout>
  );
};

export default ContactUs; 