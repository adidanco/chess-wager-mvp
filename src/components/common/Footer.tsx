import React from 'react';
import { useNavigate } from 'react-router-dom';

const Footer: React.FC = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const navigateTo = (path: string) => {
    navigate(path);
  };

  return (
    <footer className="bg-deep-purple shadow-md py-4 mt-auto pb-safe">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          {/* Copyright */}
          <div className="text-sm text-soft-pink mb-3 md:mb-0">
            © {currentYear} Gam(e)Bit. All rights reserved.
          </div>

          {/* Links */}
          <div className="flex space-x-4">
            <span
              onClick={() => navigateTo('/terms-and-conditions')}
              className="text-sm text-white hover:text-soft-pink cursor-pointer transition-colors"
            >
              Terms & Conditions
            </span>
            <span
              onClick={() => navigateTo('/contact-us')}
              className="text-sm text-white hover:text-soft-pink cursor-pointer transition-colors"
            >
              Contact Us
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
