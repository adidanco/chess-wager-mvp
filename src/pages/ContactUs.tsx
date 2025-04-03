import React from 'react';
import { Container, Typography, Paper, Box, List, ListItem, ListItemText, Divider } from '@mui/material';
import PageLayout from '../components/common/PageLayout';

const ContactUs: React.FC = () => {
  return (
    <PageLayout>
      <Container maxWidth="md">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Contact Us
          </Typography>
          
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 4 }}>
            Last updated on 19-03-2025 15:38:14
          </Typography>
          
          <Paper elevation={3} sx={{ p: 4 }}>
            <Typography paragraph>
              You may contact us using the information below:
            </Typography>
            
            <List>
              <ListItem>
                <ListItemText 
                  primary="Merchant Legal entity name:" 
                  secondary="AATITHYA HITESH VORA" 
                  primaryTypographyProps={{ fontWeight: 'bold' }}
                />
              </ListItem>
              
              <Divider component="li" />
              
              <ListItem>
                <ListItemText 
                  primary="Registered Address:" 
                  secondary="Aastha Appartment-B Block No.401,Opp SBI Bank Lane Behind Woodhardt Hospital, Rajkot Rajya Road, Gujarat, PIN: 360007" 
                  primaryTypographyProps={{ fontWeight: 'bold' }}
                />
              </ListItem>
              
              <Divider component="li" />
              
              <ListItem>
                <ListItemText 
                  primary="Operational Address:" 
                  secondary="Aastha Appartment-B Block No.401,Opp SBI Bank Lane Behind Woodhardt Hospital, Rajkot Rajya Road, Gujarat, PIN: 360007" 
                  primaryTypographyProps={{ fontWeight: 'bold' }}
                />
              </ListItem>
              
              <Divider component="li" />
              
              <ListItem>
                <ListItemText 
                  primary="Telephone No:" 
                  secondary="7862961960" 
                  primaryTypographyProps={{ fontWeight: 'bold' }}
                />
              </ListItem>
              
              <Divider component="li" />
              
              <ListItem>
                <ListItemText 
                  primary="E-Mail ID:" 
                  secondary="aatithya.apple@gmail.com" 
                  primaryTypographyProps={{ fontWeight: 'bold' }}
                />
              </ListItem>
            </List>
          </Paper>
        </Box>
      </Container>
    </PageLayout>
  );
};

export default ContactUs; 