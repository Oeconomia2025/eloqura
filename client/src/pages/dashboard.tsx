import { Routes, Route } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import Footer from './components/Footer';
import Staking from './components/Staking';
import Pools from './components/Pools';
import Dashboard from './components/Dashboard'; // Import the Dashboard component

function App() {
  const [account, setAccount] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
        setIsConnected(true);
        console.log('Wallet connected:', accounts[0]);
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    } else {
      alert('Please install MetaMask or another wallet to use this dApp!');
    }
  };

  const disconnectWallet = () => {
    setAccount('');
    setIsConnected(false);
    console.log('Wallet disconnected');
  };

  useEffect(() => {
    // Check if wallet is already connected on component mount
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsConnected(true);
            console.log('Wallet already connected:', accounts[0]);
          }
        } catch (error) {
          console.error('Error checking wallet connection:', error);
        }
      }
    };
    checkWalletConnection();

    // Listen for account changes
    window.ethereum?.on('accountsChanged', (accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
        console.log('Account changed to:', accounts[0]);
      } else {
        setAccount('');
        setIsConnected(false);
        console.log('Account disconnected');
      }
    });

    // Clean up the event listener on component unmount
    return () => {
      window.ethereum?.removeAllListeners('accountsChanged');
    };
  }, []);

  return (
    <div className="App">
      <Header
        account={account}
        isConnected={isConnected}
        connectWallet={connectWallet}
        disconnectWallet={disconnectWallet}
      />
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} /> {/* Dashboard route */}
          <Route path="/pools" element={<Pools />} />
          <Route path="/staking" element={<Staking />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;