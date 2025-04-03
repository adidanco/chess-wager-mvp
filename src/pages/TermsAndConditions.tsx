import React from 'react';
import { Container, Typography, Paper, Box } from '@mui/material';
import PageLayout from '../components/common/PageLayout';

const TermsAndConditions: React.FC = () => {
  return (
    <PageLayout>
      <Container maxWidth="md">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Terms & Conditions
          </Typography>
          
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 4 }}>
            Last updated on 02-04-2025 16:23:17
          </Typography>
          
          <Paper elevation={3} sx={{ p: 4 }}>
            <Typography paragraph>
              These Terms and Conditions, along with privacy policy or other terms ("Terms") constitute a
              binding agreement by and between AATITHYA HITESH VORA, ("Website Owner" or "we" or
              "us" or "our") and you ("you" or "your") and relate to your use of our website, goods (as
              applicable) or services (as applicable) (collectively, "Services").
            </Typography>
            
            <Typography paragraph>
              By using our website and availing the Services, you agree that you have read and accepted
              these Terms (including the Privacy Policy). We reserve the right to modify these Terms at any
              time and without assigning any reason. It is your responsibility to periodically review these Terms
              to stay informed of updates.
            </Typography>
            
            <Typography paragraph>
              The use of this website or availing of our Services is subject to the following terms of use:
            </Typography>
            
            <Typography component="div" paragraph>
              <ul style={{ paddingLeft: '20px' }}>
                <li style={{ marginBottom: '8px' }}>
                  To access and use the Services, you agree to provide true, accurate and complete information
                  to us during and after registration, and you shall be responsible for all acts done through the
                  use of your registered account.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  Neither we nor any third parties provide any warranty or guarantee as to the accuracy,
                  timeliness, performance, completeness or suitability of the information and materials offered on
                  this website or through the Services, for any specific purpose. You acknowledge that such
                  information and materials may contain inaccuracies or errors and we expressly exclude liability
                  for any such inaccuracies or errors to the fullest extent permitted by law.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  Your use of our Services and the website is solely at your own risk and discretion. You are
                  required to independently assess and ensure that the Services meet your requirements.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  The contents of the Website and the Services are proprietary to Us and you will not have any
                  authority to claim any intellectual property rights, title, or interest in its contents.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  You acknowledge that unauthorized use of the Website or the Services may lead to action
                  against you as per these Terms or applicable laws.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  You agree to pay us the charges associated with availing the Services.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  You agree not to use the website and/ or Services for any purpose that is unlawful, illegal or
                  forbidden by these Terms, or Indian or local laws that might apply to you.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  You agree and acknowledge that website and the Services may contain links to other third
                  party websites. On accessing these links, you will be governed by the terms of use, privacy
                  policy and such other policies of such third party websites.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  You understand that upon initiating a transaction for availing the Services you are entering into
                  a legally binding and enforceable contract with the us for the Services.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  You shall be entitled to claim a refund of the payment made by you in case we are not able to
                  provide the Service. The timelines for such return and refund will be according to the specific
                  Service you have availed or within the time period provided in our policies (as applicable). In
                  case you do not raise a refund claim within the stipulated time, then this would make you
                  ineligible for a refund.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  Notwithstanding anything contained in these Terms, the parties shall not be liable for any
                  failure to perform an obligation under these Terms if performance is prevented or delayed by a
                  force majeure event.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  These Terms and any dispute or claim relating to it, or its enforceability, shall be governed by
                  and construed in accordance with the laws of India.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  All disputes arising out of or in connection with these Terms shall be subject to the exclusive
                  jurisdiction of the courts in Rajkot Rajya Road, Gujarat.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  All concerns or communications relating to these Terms must be communicated to us using the
                  contact information provided on this website.
                </li>
              </ul>
            </Typography>
          </Paper>
        </Box>
      </Container>
    </PageLayout>
  );
};

export default TermsAndConditions; 