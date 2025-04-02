import React from 'react';
import { Container, Typography, Paper, Box, Divider } from '@mui/material';
import PageLayout from '../components/common/PageLayout';

const TermsAndConditions: React.FC = () => {
  return (
    <PageLayout>
      <Container maxWidth="md">
        <Paper elevation={3} sx={{ p: 4, my: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            Terms & Conditions
          </Typography>
          
          <Typography variant="subtitle1" gutterBottom sx={{ color: 'text.secondary' }}>
            Last updated on 02-04-2025 16:23:17
          </Typography>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="body1" paragraph>
            These Terms and Conditions, along with privacy policy or other terms ("Terms") constitute a binding agreement by and between AATITHYA HITESH VORA, ( "Website Owner" or "we" or "us" or "our") and you ("you" or "your") and relate to your use of our website, goods (as applicable) or services (as applicable) (collectively, "Services").
          </Typography>
          
          <Typography variant="body1" paragraph>
            By using our website and availing the Services, you agree that you have read and accepted these Terms (including the Privacy Policy). We reserve the right to modify these Terms at any time and without assigning any reason. It is your responsibility to periodically review these Terms to stay informed of updates.
          </Typography>
          
          <Typography variant="body1" paragraph>
            The use of this website or availing of our Services is subject to the following terms of use:
          </Typography>
          
          <Box component="ol" sx={{ ml: 2, mb: 3 }}>
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                To access and use the Services, you agree to provide true, accurate and complete information to us during and after registration, and you shall be responsible for all acts done through the use of your registered account.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                Neither we nor any third parties provide any warranty or guarantee as to the accuracy, timeliness, performance, completeness or suitability of the information and materials offered on this website or through the Services, for any specific purpose. You acknowledge that such information and materials may contain inaccuracies or errors and we expressly exclude liability for any such inaccuracies or errors to the fullest extent permitted by law.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                Your use of our Services and the website is solely at your own risk and discretion. You are required to independently assess and ensure that the Services meet your requirements.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                The contents of the Website and the Services are proprietary to Us and you will not have any authority to claim any intellectual property rights, title, or interest in its contents.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                You acknowledge that unauthorized use of the Website or the Services may lead to action against you as per these Terms or applicable laws.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                You agree to pay us the charges associated with availing the Services.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                You agree not to use the website and/ or Services for any purpose that is unlawful, illegal or forbidden by these Terms, or Indian or local laws that might apply to you.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                You agree and acknowledge that website and the Services may contain links to other third party websites. On accessing these links, you will be governed by the terms of use, privacy policy and such other policies of such third party websites.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                You understand that upon initiating a transaction for availing the Services you are entering into a legally binding and enforceable contract with the us for the Services.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                You shall be entitled to claim a refund of the payment made by you in case we are not able to provide the Service. The timelines for such return and refund will be according to the specific Service you have availed or within the time period provided in our policies (as applicable). In case you do not raise a refund claim within the stipulated time, than this would make you ineligible for a refund.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                Notwithstanding anything contained in these Terms, the parties shall not be liable for any failure to perform an obligation under these Terms if performance is prevented or delayed by a force majeure event.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                These Terms and any dispute or claim relating to it, or its enforceability, shall be governed by and construed in accordance with the laws of India.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                All disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in Rajkot Raiya Road, Gujarat.
              </Typography>
            </Box>
            
            <Box component="li" sx={{ mb: 1 }}>
              <Typography variant="body1">
                All concerns or communications relating to these Terms must be communicated to us using the contact information provided on this website.
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Container>
    </PageLayout>
  );
};

export default TermsAndConditions; 