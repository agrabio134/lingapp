import { useState, useEffect, useMemo } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { 
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction
} from '@solana/spl-token';
import './App.css';

function AppWrapper() {
  const network = WalletAdapterNetwork.Devnet;
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <WalletProvider wallets={wallets} autoConnect={false}>
      <App />
    </WalletProvider>
  );
}

function App() {
  const { publicKey, connected, connect, disconnect, select, wallets, signTransaction } = useWallet();
  const [walletStatus, setWalletStatus] = useState('Not connected');
  const [coinName, setCoinName] = useState('');
  const [coinSymbol, setCoinSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [initialSupply, setInitialSupply] = useState('1000000');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [xLink, setXLink] = useState('');
  const [telegramLink, setTelegramLink] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [launchStatus, setLaunchStatus] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [network, setNetwork] = useState('devnet');
  const [createdTokenInfo, setCreatedTokenInfo] = useState(null);

  useEffect(() => {
    if (connected && publicKey) {
      setWalletStatus('Connected');
    } else {
      setWalletStatus('Not connected');
    }
  }, [connected, publicKey]);

  const handleConnect = async () => {
    try {
      console.log('Available wallets:', wallets.map(w => ({
        name: w.adapter.name,
        readyState: w.readyState,
        publicKey: w.adapter.publicKey?.toString(),
      })));
      if (!wallets || wallets.length === 0) {
        setWalletStatus('No wallets detected. Install Phantom or Solflare wallet.');
        return;
      }
      if (!connected) {
        const availableWallets = wallets.filter(wallet => wallet.readyState === 'Installed' || wallet.readyState === 'Loadable');
        if (availableWallets.length === 0) {
          setWalletStatus('No wallets installed. Please install Phantom or Solflare.');
          return;
        }
        const walletToSelect = availableWallets.find(w => w.adapter.name === 'Phantom') || availableWallets[0];
        console.log('Selecting wallet:', walletToSelect.adapter.name);
        select(walletToSelect.adapter.name);
        await new Promise(resolve => setTimeout(resolve, 100));
        await connect();
        setWalletStatus('Connected');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setWalletStatus(`Connection failed: ${error.message}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setWalletStatus('Disconnected');
    } catch (error) {
      console.error('Disconnection failed:', error);
      setWalletStatus(`Disconnection failed: ${error.message}`);
    }
  };

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const maxSize = isImage ? 15 * 1024 * 1024 : 30 * 1024 * 1024;
    const allowedTypes = isImage
      ? ['image/jpeg', 'image/gif', 'image/png']
      : ['video/mp4'];

    if (!isImage && !isVideo) {
      setMediaError('File must be an image (.jpg, .gif, .png) or video (.mp4)');
      setMediaFile(null);
      setMediaPreview(null);
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      setMediaError(`Invalid file type. Use ${allowedTypes.join(', ')}`);
      setMediaFile(null);
      setMediaPreview(null);
      return;
    }

    if (file.size > maxSize) {
      setMediaError(`File too large. Max size: ${isImage ? '15MB' : '30MB'}`);
      setMediaFile(null);
      setMediaPreview(null);
      return;
    }

    if (isImage) {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        if (img.width < 400 || img.height < 400) {
          setMediaError('Image resolution must be at least 400x400px');
          setMediaFile(null);
          setMediaPreview(null);
        } else {
          setMediaError('');
          setMediaFile(file);
          setMediaPreview(URL.createObjectURL(file));
        }
      };
    } else {
      setMediaError('');
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleLaunch = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setLaunchStatus('Connect wallet first');
      return;
    }
    if (!coinName || !coinSymbol) {
      setLaunchStatus('Fill all required fields');
      return;
    }
    setLaunchStatus('Launching...');
    try {
      // Initialize connection using standard web3.js (your working approach)
      const rpcUrl = network === 'mainnet' 
        ? 'https://api.mainnet-beta.solana.com'
        : 'https://api.devnet.solana.com';
      
      const connection = new Connection(rpcUrl, 'confirmed');

      // Check wallet balance
      const balance = await connection.getBalance(publicKey);
      const minBalance = network === 'mainnet' ? 0.01 * 1000000000 : 0.001 * 1000000000;
      
      if (balance < minBalance) {
        setLaunchStatus(`Insufficient SOL balance. Need at least ${network === 'mainnet' ? '0.01' : '0.001'} SOL.`);
        return;
      }

      // Fund wallet with SOL for testing (devnet only)
      if (network === 'devnet') {
        try {
          const airdropSignature = await connection.requestAirdrop(publicKey, 1000000000); // 1 SOL
          await connection.confirmTransaction(airdropSignature);
          console.log('Airdrop successful');
        } catch (error) {
          console.warn('Airdrop failed, proceeding with existing balance:', error.message);
        }
      }

      setLaunchStatus('Creating mint...');

      // Generate keypair for mint
      const mintKeypair = Keypair.generate();
      const mintPublicKey = mintKeypair.publicKey;

      // Get the minimum balance for rent exemption
      const mintRent = await getMinimumBalanceForRentExemptMint(connection);

      // Create transaction for mint creation
      const transaction = new Transaction();
      
      // Add instruction to create mint account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintPublicKey,
          space: MINT_SIZE,
          lamports: mintRent,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      // Add instruction to initialize mint
      transaction.add(
        createInitializeMintInstruction(
          mintPublicKey,
          6, // decimals
          publicKey, // mint authority
          publicKey // freeze authority
        )
      );

      // Get associated token account address
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintPublicKey,
        publicKey
      );

      // Add instruction to create associated token account
      transaction.add(
        createAssociatedTokenAccountInstruction(
          publicKey, // payer
          associatedTokenAddress, // associated token account
          publicKey, // owner
          mintPublicKey // mint
        )
      );

      // Add instruction to mint initial supply
      const supply = BigInt(parseInt(initialSupply)) * BigInt(Math.pow(10, 6));
      
      transaction.add(
        createMintToInstruction(
          mintPublicKey, // mint
          associatedTokenAddress, // destination
          publicKey, // mint authority
          supply // amount
        )
      );

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Partially sign with mint keypair
      transaction.partialSign(mintKeypair);

      setLaunchStatus('Please approve the transaction in your wallet...');

      // Sign with wallet
      const signedTransaction = await signTransaction(transaction);

      setLaunchStatus('Sending transaction...');

      // Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Transaction signature:', signature);

      // Store token info for display
      const tokenInfo = {
        name: coinName,
        symbol: coinSymbol,
        supply: parseInt(initialSupply).toLocaleString(),
        mintAddress: mintPublicKey.toString(),
        tokenAccount: associatedTokenAddress.toString(),
        network: network,
        transactionSignature: signature
      };
      setCreatedTokenInfo(tokenInfo);

      setLaunchStatus(`Token launched successfully! Scroll down to view details.`);

    } catch (error) {
      console.error('Launch error:', error);
      setLaunchStatus(`Error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-white font-inter bg-gray-900">
      <nav className="flex justify-between items-center bg-black bg-opacity-90 p-4 fixed w-full top-0 z-50">
        <div className="flex items-center gap-2">
          <img src="panda-portrait.jpg" alt="LingLaunch Logo" className="w-9 h-9 rounded-full object-cover border-2 border-green-500" />
          <span className="text-2xl font-bold">LingLaunch</span>
        </div>
        <div className="flex gap-4 items-center">
          <select 
            value={network} 
            onChange={(e) => setNetwork(e.target.value)}
            className="bg-gray-800 text-white px-3 py-1 rounded text-sm border border-gray-600"
          >
            <option value="devnet">Devnet (Free)</option>
            <option value="mainnet">Mainnet (Real)</option>
          </select>
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${network === 'mainnet' ? 'bg-red-600' : 'bg-blue-600'}`}>
            {network === 'mainnet' ? 'MAINNET' : 'DEVNET'}
          </div>
          <button
            onClick={connected ? handleDisconnect : handleConnect}
            className={`panda-btn ${connected ? 'connected' : ''}`}
          >
            {connected && publicKey
              ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`
              : 'Connect Wallet'}
          </button>
        </div>
      </nav>

      <section className="p-8 mt-20 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-3xl font-bold mb-4">Create a Token</h2>
          <div className={`border p-4 rounded-lg mb-4 ${network === 'mainnet' ? 'bg-red-900 border-red-600' : 'bg-blue-900 border-blue-600'}`}>
            <p className={`font-bold ${network === 'mainnet' ? 'text-red-200' : 'text-blue-200'}`}>
              {network === 'mainnet' ? 'MAINNET DEPLOYMENT' : 'DEVNET DEPLOYMENT'}
            </p>
            <p className={`text-sm mt-2 ${network === 'mainnet' ? 'text-red-300' : 'text-blue-300'}`}>
              {network === 'mainnet' 
                ? 'This will create a real token on Solana mainnet using real SOL.'
                : 'This will create a test token on Solana devnet using free SOL.'
              }
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="form-group">
              <label htmlFor="coin-name" className="form-label">Token Name *</label>
              <input
                type="text"
                id="coin-name"
                value={coinName}
                onChange={(e) => setCoinName(e.target.value)}
                placeholder="e.g., LingCoin"
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="coin-symbol" className="form-label">Symbol *</label>
              <input
                type="text"
                id="coin-symbol"
                value={coinSymbol}
                onChange={(e) => setCoinSymbol(e.target.value.toUpperCase())}
                placeholder="e.g., LING"
                maxLength="10"
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="initial-supply" className="form-label">Initial Supply</label>
              <input
                type="number"
                id="initial-supply"
                value={initialSupply}
                onChange={(e) => setInitialSupply(e.target.value)}
                placeholder="1000000"
                min="1"
                max="1000000000000"
                className="form-input"
              />
              <p className="text-sm text-gray-400 mt-1">Default: 1,000,000 tokens (6 decimals)</p>
            </div>
            <div className="form-group">
              <label htmlFor="description" className="form-label">Description</label>
              <textarea
                id="description"
                rows="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Token description..."
                className="form-input"
              ></textarea>
            </div>
            <div className="form-group">
              <label htmlFor="media-upload" className="form-label">Select Video or Image</label>
              <input
                type="file"
                id="media-upload"
                accept="image/jpeg,image/gif,image/png,video/mp4"
                onChange={handleMediaChange}
                className="form-input"
              />
              <p className="text-sm text-gray-400 mt-2">
                Image: Max 15MB (.jpg, .gif, .png), min 400x400px, 1:1 recommended<br />
                Video: Max 30MB (.mp4), 16:9 or 9:16, 1080p+ recommended
              </p>
              {mediaError && <p className="text-red-500 text-sm mt-2">{mediaError}</p>}
            </div>
            <div className="form-group">
              <label htmlFor="x-link" className="form-label">X Profile</label>
              <input
                type="text"
                id="x-link"
                value={xLink}
                onChange={(e) => setXLink(e.target.value)}
                placeholder="e.g., https://x.com/LingDotFun"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="telegram-link" className="form-label">Telegram</label>
              <input
                type="text"
                id="telegram-link"
                value={telegramLink}
                onChange={(e) => setTelegramLink(e.target.value)}
                placeholder="e.g., https://t.me/linglaunch"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="website-link" className="form-label">Website</label>
              <input
                type="text"
                id="website-link"
                value={websiteLink}
                onChange={(e) => setWebsiteLink(e.target.value)}
                placeholder="e.g., https://linglaunch.com"
                className="form-input"
              />
            </div>
            <button className="panda-btn w-full mt-4" onClick={handleLaunch}>
              Launch Token on {network.charAt(0).toUpperCase() + network.slice(1)}
            </button>
            <div className="text-center mt-2">
              <p className="text-sm text-yellow-400">Required: Connect wallet + Fill name & symbol</p>
              <p className={`text-sm mt-1 ${network === 'mainnet' ? 'text-red-400' : 'text-blue-400'}`}>
                Cost: ~{network === 'mainnet' ? '0.005-0.01 SOL' : '0.001 SOL (free from faucet)'} for deployment
              </p>
              <p className="text-center mt-2">{launchStatus}</p>
            </div>
            <p className="text-center text-sm text-gray-400 mt-2">{walletStatus}</p>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold mb-4">Preview</h2>
          <div className="bg-gray-800 p-4 rounded-lg">
            {mediaPreview ? (
              mediaPreview.includes('.mp4') ? (
                <video src={mediaPreview} controls className="w-full h-auto rounded-lg" />
              ) : (
                <img src={mediaPreview} alt="Token Preview" className="w-full h-auto rounded-lg max-h-64 object-cover" />
              )
            ) : (
              <div className="w-full h-64 bg-gray-700 flex items-center justify-center rounded-lg">
                <p className="text-gray-400">No media selected</p>
              </div>
            )}
            <div className="mt-4">
              <p><strong>Name:</strong> {coinName || 'Not set'}</p>
              <p><strong>Symbol:</strong> {coinSymbol || 'Not set'}</p>
              <p><strong>Supply:</strong> {initialSupply ? `${parseInt(initialSupply).toLocaleString()} ${coinSymbol || 'tokens'}` : 'Not set'}</p>
              <p><strong>Description:</strong> {description || 'Not set'}</p>
              <p><strong>X:</strong> {xLink || 'Not set'}</p>
              <p><strong>Telegram:</strong> {telegramLink || 'Not set'}</p>
              <p><strong>Website:</strong> {websiteLink || 'Not set'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Token Success Section */}
      {createdTokenInfo && (
        <section className="p-8 max-w-4xl mx-auto">
          <div className="bg-green-900 border border-green-600 p-6 rounded-lg">
            <h3 className="text-2xl font-bold text-green-200 mb-4">Token Created Successfully!</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-green-300 font-semibold">Token Details:</p>
                  <p className="text-white">{createdTokenInfo.name} ({createdTokenInfo.symbol})</p>
                  <p className="text-gray-300">Supply: {createdTokenInfo.supply}</p>
                  <p className="text-gray-300">Network: {createdTokenInfo.network.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-green-300 font-semibold">Mint Address:</p>
                  <p className="text-white break-all text-sm font-mono bg-gray-800 p-2 rounded">
                    {createdTokenInfo.mintAddress}
                  </p>
                </div>
                <div>
                  <p className="text-green-300 font-semibold">Your Token Account:</p>
                  <p className="text-white break-all text-sm font-mono bg-gray-800 p-2 rounded">
                    {createdTokenInfo.tokenAccount}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-green-300 font-semibold mb-3">View Your Token:</p>
                  <div className="space-y-2">
                    <a 
                      href={`https://explorer.solana.com/address/${createdTokenInfo.mintAddress}${createdTokenInfo.network === 'devnet' ? '?cluster=devnet' : ''}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-center transition-colors"
                    >
                      📊 View on Solana Explorer
                    </a>
                    <a 
                      href={`https://solscan.io/token/${createdTokenInfo.mintAddress}${createdTokenInfo.network === 'devnet' ? '?cluster=devnet' : ''}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-center transition-colors"
                    >
                      🔍 View on SolScan
                    </a>
                    <a 
                      href={`https://explorer.solana.com/tx/${createdTokenInfo.transactionSignature}${createdTokenInfo.network === 'devnet' ? '?cluster=devnet' : ''}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-center transition-colors"
                    >
                      📝 View Transaction
                    </a>
                  </div>
                </div>
                
                {createdTokenInfo.network === 'mainnet' && (
                  <div>
                    <p className="text-green-300 font-semibold mb-3">Add Liquidity & Trading:</p>
                    <div className="space-y-2">
                      <a 
                        href="https://raydium.io/liquidity/create/"
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded text-center transition-colors"
                      >
                        💧 Create Pool on Raydium
                      </a>
                      <a 
                        href="https://www.orca.so/pools"
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-4 py-2 rounded text-center transition-colors"
                      >
                        🐋 Create Pool on Orca
                      </a>
                      <a 
                        href="https://dex.meteora.ag/pools/create"
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-4 py-2 rounded text-center transition-colors"
                      >
                        ⚡ Create Pool on Meteora
                      </a>
                    </div>
                  </div>
                )}
                
                {createdTokenInfo.network === 'mainnet' && (
                  <div>
                    <p className="text-green-300 font-semibold mb-3">List & Promote:</p>
                    <div className="space-y-2">
                      <a 
                        href="https://station.jup.ag/docs/token-list/token-list-api"
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-center transition-colors"
                      >
                        🪐 Submit to Jupiter Token List
                      </a>
                      <a 
                        href="https://www.coingecko.com/en/coins/new"
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-center transition-colors"
                      >
                        🦎 Apply to CoinGecko
                      </a>
                      <a 
                        href="https://coinmarketcap.com/request/"
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded text-center transition-colors"
                      >
                        📈 Apply to CoinMarketCap
                      </a>
                      <a 
                        href={`https://twitter.com/intent/tweet?text=Just launched ${createdTokenInfo.name} (${createdTokenInfo.symbol}) on Solana! 🚀%0A%0AMint Address: ${createdTokenInfo.mintAddress}%0A%0AView on Explorer: https://explorer.solana.com/address/${createdTokenInfo.mintAddress}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block bg-black hover:bg-gray-800 text-white px-4 py-2 rounded text-center transition-colors border border-gray-600"
                      >
                        𝕏 Share on X (Twitter)
                      </a>
                    </div>
                  </div>
                )}

                {createdTokenInfo.network === 'devnet' && (
                  <div className="bg-blue-900 border border-blue-600 p-3 rounded">
                    <p className="text-blue-200 text-sm font-semibold">Devnet Token Created!</p>
                    <p className="text-blue-300 text-sm mt-2">
                      This is a test token. To create a real tradeable token, switch to Mainnet and launch again.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="text-center p-8">
        <p className="text-gray-400">Powered by Solana</p>
      </div>

      <footer className="bg-black p-4 text-center text-gray-400 text-sm">
        <p>© 2025 LingLaunch. Powered by Solana.</p>
      </footer>
    </div>
  );
}

export default AppWrapper;