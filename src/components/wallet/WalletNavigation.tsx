import React from 'react';
import { Link } from 'react-router-dom';

interface WalletNavigationProps {
  activeTab: 'deposit' | 'withdraw' | 'history';
  setActiveTab: (tab: 'deposit' | 'withdraw' | 'history') => void;
}

const WalletNavigation: React.FC<WalletNavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <ul className="nav nav-tabs mb-4">
      <li className="nav-item">
        <a 
          className={`nav-link ${activeTab === 'deposit' ? 'active' : ''}`} 
          href="#" 
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('deposit');
          }}
        >
          Deposit
        </a>
      </li>
      <li className="nav-item">
        <a 
          className={`nav-link ${activeTab === 'withdraw' ? 'active' : ''}`} 
          href="#" 
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('withdraw');
          }}
        >
          Withdraw
        </a>
      </li>
      <li className="nav-item">
        <a 
          className={`nav-link ${activeTab === 'history' ? 'active' : ''}`} 
          href="#" 
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('history');
          }}
        >
          Transaction History
        </a>
      </li>
    </ul>
  );
};

export default WalletNavigation; 