import { useState, useEffect, useMemo, useRef } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL, TransactionInstruction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Rocket, TrendingUp, Users, DollarSign, ExternalLink,
  Copy, CheckCircle, Globe, MessageCircle, Upload,
  Wallet, BarChart3, Calendar, Clock, Lock, ShieldCheck,
  ChevronDown, Info, Twitter, ArrowRight, Plus,
  AlertCircle, FileText, Award
} from 'lucide-react';

// Define Metaplex program ID
const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Configurable RPC endpoints
const RPC_CONFIG = {
  devnet: 'https://api.devnet.solana.com',
  mainnet: process.env.REACT_APP_MAINNET_RPC || 'https://solana-mainnet.g.alchemy.com/v2/FKINhha0yp9CvQeOTYjq4', // Use env variable for mainnet RPC
};

// Bonding Curve Visualization Component
const BondingCurveChart = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, 'rgba(14, 165, 233, 0.1)');
    gradient.addColorStop(1, 'rgba(14, 165, 233, 0.5)');

    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let x = 0; x < width; x++) {
      const progress = x / width;
      const y = height - (Math.pow(progress, 1.5) * height * 0.8 + height * 0.1);
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, height - height * 0.1);

    for (let x = 0; x < width; x++) {
      const progress = x / width;
      const y = height - (Math.pow(progress, 1.5) * height * 0.8 + height * 0.1);
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    for (let i = 1; i < 5; i++) {
      const x = (width / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter';
    ctx.fillText('Token Supply →', width - 100, height - 10);
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Price →', 0, 0);
    ctx.restore();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={230}
      style={{ width: '100%', height: '230px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '10px' }}
    />
  );
};

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
      <SolanaTokenLaunchpad />
    </WalletProvider>
  );
}

function SolanaTokenLaunchpad() {
  const { publicKey, connected, connect, disconnect, select, wallets, signTransaction } = useWallet();
  const [currentStep, setCurrentStep] = useState(1);
  const [activeTab, setActiveTab] = useState('create');
  const [network, setNetwork] = useState('devnet');
  const [launchStatus, setLaunchStatus] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);
  const [fee, setFee] = useState(0.01);
  const [feeInUsd, setFeeInUsd] = useState(0);
  const [solPrice, setSolPrice] = useState(0);
  const [copied, setCopied] = useState('');
  const [advancedMode, setAdvancedMode] = useState(false);

  const [tokenData, setTokenData] = useState({
    name: '',
    symbol: '',
    description: '',
    supply: 1000000,
    decimals: 9,
    website: '',
    telegram: '',
    twitter: '',
    image: null,
    initialPrice: 0.001,
    softCap: 50,
    hardCap: 200,
    minBuy: 0.1,
    maxBuy: 5,
    liquidityPercentage: 70,
    liquidityLockup: 180,
  });

  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaError, setMediaError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [createdTokenInfo, setCreatedTokenInfo] = useState(null);
  const [launchedTokens, setLaunchedTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);

  // Fetch SOL price
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await response.json();
        const price = data.solana.usd;
        setSolPrice(price);
        setFeeInUsd((fee * price).toFixed(2));
      } catch (error) {
        console.error('Failed to fetch SOL price:', error);
        setSolPrice(150); // Fallback price
        setFeeInUsd((fee * 150).toFixed(2));
      }
    };
    fetchSolPrice();
  }, [fee]);

  const handleConnect = async () => {
    try {
      if (!wallets || wallets.length === 0) {
        setLaunchStatus('No wallets detected. Install Phantom or Solflare wallet.');
        return;
      }
      if (!connected) {
        const availableWallets = wallets.filter(wallet => wallet.readyState === 'Installed' || wallet.readyState === 'Loadable');
        if (availableWallets.length === 0) {
          setLaunchStatus('No wallets installed. Please install Phantom or Solflare.');
          return;
        }
        const walletToSelect = availableWallets.find(w => w.adapter.name === 'Phantom') || availableWallets[0];
        select(walletToSelect.adapter.name);
        await new Promise(resolve => setTimeout(resolve, 100));
        await connect();
        setLaunchStatus('Wallet connected successfully!');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setLaunchStatus(`Connection failed: ${error.message}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setLaunchStatus('Wallet disconnected');
    } catch (error) {
      console.error('Disconnection failed:', error);
      setLaunchStatus(`Disconnection failed: ${error.message}`);
    }
  };

  const handleInputChange = (field, value) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
    // Enforce symbol length in UI
    if (field === 'symbol') {
      value = value.slice(0, 10); // Limit to 10 characters
    }
    setTokenData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (validationErrors.image) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated.image;
        return updated;
      });
    }

    const isImage = file.type.startsWith('image/');
    const maxSize = 15 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];

    if (!isImage) {
      setMediaError('File must be an image (.jpg, .png, .gif)');
      setTokenData(prev => ({ ...prev, image: null }));
      setMediaPreview(null);
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      setMediaError('Invalid file type. Use .jpg, .png, or .gif');
      setTokenData(prev => ({ ...prev, image: null }));
      setMediaPreview(null);
      return;
    }

    if (file.size > maxSize) {
      setMediaError('File too large. Max size: 15MB');
      setTokenData(prev => ({ ...prev, image: null }));
      setMediaPreview(null);
      return;
    }

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      if (img.width < 400 || img.height < 400) {
        setMediaError('Image resolution must be at least 400x400px');
        setTokenData(prev => ({ ...prev, image: null }));
        setMediaPreview(null);
      } else {
        setMediaError('');
        setTokenData(prev => ({ ...prev, image: file }));
        setMediaPreview(URL.createObjectURL(file));
      }
    };
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(0);
  };

  const formatPrice = (price) => {
    return price < 0.001 ? price.toFixed(6) : price.toFixed(4);
  };

  const validateForm = () => {
    const errors = {};
    if (!tokenData.name.trim()) errors.name = 'Token name is required';
    if (!tokenData.symbol.trim()) errors.symbol = 'Symbol is required';
    if (!tokenData.supply || tokenData.supply <= 0) errors.supply = 'Supply must be greater than 0';
    if (tokenData.symbol && !/^[A-Z0-9]{2,10}$/.test(tokenData.symbol)) {
      errors.symbol = 'Symbol must be 2-10 uppercase letters or numbers';
    }
    if (tokenData.supply > 1000000000000) {
      errors.supply = 'Supply cannot exceed 1 trillion tokens';
    }
    const urlRegex = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/;
    if (tokenData.website && !urlRegex.test(tokenData.website)) {
      errors.website = 'Please enter a valid URL';
    }
    if (advancedMode) {
      if (tokenData.hardCap <= tokenData.softCap) {
        errors.hardCap = 'Hard cap must be greater than soft cap';
      }
      if (tokenData.maxBuy <= tokenData.minBuy) {
        errors.maxBuy = 'Max buy must be greater than min buy';
      }
      if (tokenData.liquidityPercentage < 50) {
        errors.liquidityPercentage = 'Liquidity must be at least 50%';
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Mock IPFS upload (replace with actual IPFS service like Pinata in production)
  const uploadImageToIPFS = async (file) => {
    return 'https://ipfs.io/ipfs/mock-cid-' + Date.now();
  };

  // Helper to serialize string with length prefix
  const serializeString = (str, maxLength) => {
    const trimmed = str.slice(0, maxLength);
    const buf = Buffer.from(trimmed, 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32LE(buf.length, 0);
    return Buffer.concat([len, buf, Buffer.alloc(maxLength - buf.length)]);
  };

  async function handleLaunch() {
    if (!connected || !publicKey || !signTransaction) {
      setLaunchStatus('Connect wallet first');
      return;
    }
    if (!validateForm()) {
      setLaunchStatus('Please fix the form errors before proceeding');
      return;
    }

    setIsLaunching(true);
    setLaunchStatus('Launching...');

    let connection;
    try {
      const rpcUrl = RPC_CONFIG[network];
      if (network === 'mainnet' && rpcUrl === 'https://api.mainnet-beta.solana.com') {
        setLaunchStatus('Warning: Using public mainnet RPC may result in 403 errors. Configure a private RPC (e.g., Alchemy, QuickNode) for reliable access. See https://docs.alchemy.com or https://www.quicknode.com.');
      }
      connection = new Connection(rpcUrl, 'confirmed');

      // Check balance with retry logic
      let balance;
      let balanceAttempts = 0;
      const maxBalanceAttempts = 3;
      while (balanceAttempts < maxBalanceAttempts) {
        try {
          balance = await connection.getBalance(publicKey);
          break;
        } catch (error) {
          balanceAttempts++;
          if (error.message.includes('403')) {
            setLaunchStatus(`Failed to fetch balance: Access forbidden. Configure a private RPC endpoint (e.g., Alchemy: https://docs.alchemy.com, QuickNode: https://www.quicknode.com). Attempt ${balanceAttempts}/${maxBalanceAttempts}`);
            if (balanceAttempts >= maxBalanceAttempts) {
              throw new Error('Balance check failed: Access forbidden. Please use a private RPC endpoint.');
            }
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, balanceAttempts) * 1000));
          } else {
            throw error;
          }
        }
      }

      const minBalance = 0.01 * LAMPORTS_PER_SOL;
      if (balance < minBalance) {
        // Attempt airdrop for devnet only
        if (network === 'devnet') {
          let airdropAttempts = 0;
          const maxAirdropAttempts = 5;
          while (airdropAttempts < maxAirdropAttempts) {
            try {
              setLaunchStatus('Requesting airdrop (devnet only)...');
              const airdropSignature = await connection.requestAirdrop(publicKey, 0.01 * LAMPORTS_PER_SOL);
              await connection.confirmTransaction(airdropSignature, 'confirmed');
              setLaunchStatus('Airdrop successful');
              balance = await connection.getBalance(publicKey);
              break;
            } catch (error) {
              airdropAttempts++;
              if (error.message.includes('429')) {
                const delay = Math.pow(2, airdropAttempts) * 500;
                setLaunchStatus(`Airdrop failed: Too many requests. Retrying after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
              } else {
                setLaunchStatus(`Airdrop failed: ${error.message}. Visit https://faucet.solana.com for alternative faucets. Continuing without airdrop...`);
                break;
              }
            }
          }
          if (airdropAttempts >= maxAirdropAttempts) {
            setLaunchStatus('Airdrop failed after max retries. Visit https://faucet.solana.com or ensure sufficient SOL balance.');
          }
        }
        if (balance < minBalance) {
          setLaunchStatus(`Insufficient SOL balance. Need at least 0.01 SOL. Current balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
          setIsLaunching(false);
          return;
        }
      }

      setLaunchStatus('Creating mint account...');
      const mintKeypair = Keypair.generate();
      const mintPublicKey = mintKeypair.publicKey;
      if (!mintPublicKey) {
        throw new Error('Failed to generate mint public key');
      }
      const mintRent = await getMinimumBalanceForRentExemptMint(connection);

      const transaction = new Transaction();

      // Create mint account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintPublicKey,
          space: MINT_SIZE,
          lamports: mintRent,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      // Initialize mint
      transaction.add(
        createInitializeMintInstruction(
          mintPublicKey,
          tokenData.decimals,
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID
        )
      );

      // Add metadata using CreateMetadataAccountV3
      setLaunchStatus('Creating metadata account...');
      const [metadataPDA] = await PublicKey.findProgramAddress(
        [
          Buffer.from('metadata'),
          METAPLEX_PROGRAM_ID.toBuffer(),
          mintPublicKey.toBuffer(),
        ],
        METAPLEX_PROGRAM_ID
      );

      // Upload image to IPFS if provided
      const uri = tokenData.image ? await uploadImageToIPFS(tokenData.image) : '';

      // CreateMetadataAccountV3 instruction data (discriminator: 33)
      const name = tokenData.name.slice(0, 32);
      const symbol = tokenData.symbol.slice(0, 10);
      const uriString = uri.slice(0, 200);
      const sellerFeeBasisPoints = 0; // 0% royalty
      const isMutable = true;

      // Serialize instruction data using Borsh format
      const metadataData = Buffer.concat([
        Buffer.from([33]), // CreateMetadataAccountV3 discriminator
        serializeString(name), // name
        serializeString(symbol), // symbol  
        serializeString(uriString), // uri
        Buffer.from([sellerFeeBasisPoints & 0xff, (sellerFeeBasisPoints >> 8) & 0xff]), // seller_fee_basis_points (u16)
        Buffer.from([0]), // creators: Option<Vec<Creator>> = None
        Buffer.from([0]), // collection: Option<Collection> = None
        Buffer.from([0]), // uses: Option<Uses> = None
        Buffer.from([isMutable ? 1 : 0]), // is_mutable
        Buffer.from([0]), // collection_details: Option<CollectionDetails> = None
      ]);

      console.log('CreateMetadataAccountV3 data:', metadataData.toString('hex'));
      console.log('Metadata PDA:', metadataPDA.toString());
      console.log('Mint:', mintPublicKey.toString());

      // Construct CreateMetadataAccountV3 instruction
      const metadataInstruction = new TransactionInstruction({
        programId: METAPLEX_PROGRAM_ID,
        keys: [
          { pubkey: metadataPDA, isSigner: false, isWritable: true }, // Metadata account
          { pubkey: mintPublicKey, isSigner: false, isWritable: false }, // Mint
          { pubkey: publicKey, isSigner: true, isWritable: false }, // Mint authority
          { pubkey: publicKey, isSigner: true, isWritable: true }, // Payer
          { pubkey: publicKey, isSigner: false, isWritable: false }, // Update authority
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent sysvar
        ],
        data: metadataData,
      });

      transaction.add(metadataInstruction);

      // Set blockhash and sign
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      transaction.partialSign(mintKeypair);

      try {
        setLaunchStatus('Please approve transaction in wallet...');
        const signedTransaction = await signTransaction(transaction);

        setLaunchStatus('Broadcasting transaction...');
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3
        });

        setLaunchStatus(`Transaction sent: ${signature.slice(0, 8)}...`);

        // Improved confirmation with fallback strategy
        let confirmed = false;
        let confirmationAttempts = 0;
        const maxConfirmationAttempts = 3;

        while (!confirmed && confirmationAttempts < maxConfirmationAttempts) {
          try {
            confirmationAttempts++;
            setLaunchStatus(`Confirming transaction (attempt ${confirmationAttempts}/${maxConfirmationAttempts})...`);

            // Use a longer timeout and different commitment level
            await connection.confirmTransaction({
              signature,
              blockhash: transaction.recentBlockhash,
              lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight + 150
            }, 'confirmed');

            confirmed = true;

          } catch (confirmError) {
            console.warn(`Confirmation attempt ${confirmationAttempts} failed:`, confirmError);

            if (confirmationAttempts >= maxConfirmationAttempts) {
              // Fallback: Check transaction status manually
              setLaunchStatus('Checking transaction status...');

              try {
                const txStatus = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });

                if (txStatus?.value?.confirmationStatus) {
                  if (txStatus.value.err) {
                    throw new Error(`Transaction failed: ${JSON.stringify(txStatus.value.err)}`);
                  }

                  if (txStatus.value.confirmationStatus === 'confirmed' || txStatus.value.confirmationStatus === 'finalized') {
                    confirmed = true;
                    setLaunchStatus(`Transaction confirmed via status check: ${signature}`);
                  } else {
                    throw new Error(`Transaction status: ${txStatus.value.confirmationStatus}`);
                  }
                } else {
                  // Last resort: Check if mint account exists
                  try {
                    const mintInfo = await connection.getAccountInfo(mintPublicKey);
                    if (mintInfo && mintInfo.data.length > 0) {
                      confirmed = true;
                      setLaunchStatus('Token creation verified via account check');
                    } else {
                      throw new Error('Transaction timeout - mint account not found');
                    }
                  } catch (accountError) {
                    throw new Error(`Transaction confirmation failed: ${confirmError.message}`);
                  }
                }
              } catch (statusError) {
                throw new Error(`Transaction confirmation failed: ${statusError.message}`);
              }
            } else {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        // Continue with token info creation only after successful confirmation
        if (confirmed) {
          // Store token info
          const tokenInfo = {
            id: mintPublicKey.toString(),
            name: tokenData.name,
            symbol: tokenData.symbol,
            description: tokenData.description,
            supply: parseInt(tokenData.supply),
            website: tokenData.website,
            telegram: tokenData.telegram,
            twitter: tokenData.twitter,
            image: mediaPreview,
            currentPrice: tokenData.initialPrice,
            marketCap: parseInt(tokenData.supply) * tokenData.initialPrice,
            progress: 0,
            holders: 1,
            volume24h: 0,
            createdAt: new Date(),
            transactionSignature: signature,
            network,
          };

          setCreatedTokenInfo(tokenInfo);
          setLaunchedTokens(prev => [tokenInfo, ...prev]);
          setSelectedToken(tokenInfo);
          setActiveTab('monitor');
          setLaunchStatus(`Token created successfully! Signature: ${signature}`);

          // Reset form
          setTokenData({
            name: '',
            symbol: '',
            description: '',
            supply: 1000000,
            decimals: 9,
            website: '',
            telegram: '',
            twitter: '',
            image: null,
            initialPrice: 0.001,
            softCap: 50,
            hardCap: 200,
            minBuy: 0.1,
            maxBuy: 5,
            liquidityPercentage: 70,
            liquidityLockup: 180,
          });
          setMediaPreview(null);
        }

      } catch (error) {
        console.error('Launch error:', error);

        // Enhanced error handling
        let errorMessage = `Error: ${error.message}`;

        if (error.message.includes('Transaction was not confirmed')) {
          const signature = error.message.match(/signature (\w+)/)?.[1];
          if (signature) {
            errorMessage = `Transaction may have succeeded but confirmation timed out. Check signature: ${signature}`;
            setLaunchStatus(errorMessage + ` - Check in Explorer: https://explorer.solana.com/tx/${signature}${network === 'devnet' ? '?cluster=devnet' : ''}`);
          }
        } else if (error.name === 'SendTransactionError') {
          try {
            const logs = await connection.getLogs(signature);
            errorMessage = `Transaction failed: ${error.message}. Logs: ${JSON.stringify(logs, null, 2)}`;
          } catch (logError) {
            errorMessage = `Transaction failed: ${error.message}`;
          }
        }

        setLaunchStatus(errorMessage);
      }
    } finally {
      setIsLaunching(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col text-white font-sans bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950">
      <nav className="flex justify-between items-center bg-black/90 backdrop-blur-lg px-4 py-3 fixed w-full top-0 z-50 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-violet-500">
            <img src="https://dd.dexscreener.com/ds-data/tokens/solana/DaUq6WNeLkwjdnWFk3xC6NVXpTXfLotVnUCd4qL9Ling.png?size=lg&key=a4ee8c" alt="" srcset="" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-800/50 rounded-full p-1 border border-slate-700">
            <button
              onClick={() => setNetwork('devnet')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${network === 'devnet' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
            >
              Devnet
            </button>
            <button
              onClick={() => setNetwork('mainnet')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${network === 'mainnet' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
            >
              Mainnet
            </button>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${network === 'mainnet' ? 'bg-red-600' : 'bg-blue-600'}`}>
            {network === 'mainnet' ? 'MAINNET' : 'DEVNET'}
          </div>
          <button
            onClick={connected ? handleDisconnect : handleConnect}
            className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${connected ? 'from-green-500 to-emerald-600' : 'from-blue-500 to-violet-600'
              } text-white font-medium hover:shadow-lg transition-all`}
          >
            <Wallet size={16} />
            {connected && publicKey
              ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`
              : 'Connect Wallet'}
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto w-full px-4 pt-20 pb-10">
        <div className="flex justify-center my-6">
          <div className="bg-slate-800/30 p-1 rounded-lg flex gap-1 border border-slate-700/50">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${activeTab === 'create'
                  ? 'bg-gradient-to-r from-blue-500 to-violet-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                }`}
            >
              Create Token
            </button>
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-6 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${activeTab === 'monitor'
                  ? 'bg-gradient-to-r from-blue-500 to-violet-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                }`}
            >
              Monitor Launches
              {launchedTokens.length > 0 && (
                <span className="bg-blue-600 px-2 py-0.5 rounded-full text-xs">{launchedTokens.length}</span>
              )}
            </button>
          </div>
        </div>

        {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Rocket size={24} className="text-blue-400" />
                Launch Your Token
              </h2>
              <div className={`border rounded-lg p-4 mb-6 ${network === 'mainnet' ? 'bg-red-900/20 border-red-500/30' : 'bg-blue-900/20 border-blue-500/30'}`}>
                <p className={`font-bold ${network === 'mainnet' ? 'text-red-300' : 'text-blue-300'}`}>
                  {network === 'mainnet' ? 'MAINNET DEPLOYMENT' : 'DEVNET DEPLOYMENT'}
                </p>
                <p className={`text-sm mt-1 ${network === 'mainnet' ? 'text-red-200/70' : 'text-blue-200/70'}`}>
                  {network === 'mainnet'
                    ? 'This will create a real token on Solana mainnet using real SOL. Configure a private RPC endpoint (e.g., Alchemy, QuickNode) to avoid 403 errors.'
                    : 'This will create a test token on Solana devnet using free SOL from faucets.'}
                </p>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Token Image</label>
                  <label
                    htmlFor="imageUpload"
                    className={`block border-2 border-dashed border-slate-600 rounded-xl p-8 text-center bg-slate-800/30 cursor-pointer transition-all hover:border-blue-400/50 hover:bg-slate-800/50 ${validationErrors.image ? 'border-red-500/70' : ''
                      }`}
                  >
                    {mediaPreview ? (
                      <img src={mediaPreview} alt="Token" className="w-24 h-24 rounded-full object-cover mx-auto" />
                    ) : (
                      <div>
                        <Upload size={32} className="mx-auto mb-3 text-blue-400" />
                        <p className="text-slate-400">Drop image here or click to upload</p>
                        <p className="text-slate-500 text-sm mt-2">Max 15MB (.jpg, .png, .gif), min 400x400px</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="imageUpload" />
                  </label>
                  {mediaError && <p className="text-red-400 text-sm mt-2">{mediaError}</p>}
                  {validationErrors.image && <p className="text-red-400 text-sm mt-2">{validationErrors.image}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Token Name *</label>
                    <input
                      type="text"
                      placeholder="My Awesome Token"
                      value={tokenData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className={`w-full bg-slate-800/70 border ${validationErrors.name ? 'border-red-500/70' : 'border-slate-600'
                        } rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent`}
                    />
                    {validationErrors.name && <p className="text-red-400 text-sm mt-1">{validationErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Token Symbol *</label>
                    <input
                      type="text"
                      placeholder="TICKER"
                      value={tokenData.symbol}
                      onChange={(e) => handleInputChange('symbol', e.target.value)}
                      className={`w-full bg-slate-800/70 border ${validationErrors.symbol ? 'border-red-500/70' : 'border-slate-600'
                        } rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent`}
                    />
                    {validationErrors.symbol && <p className="text-red-400 text-sm mt-1">{validationErrors.symbol}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                  <textarea
                    placeholder="Describe your token and its purpose..."
                    value={tokenData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows="3"
                    className="w-full bg-slate-800/70 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                    style={{ resize: 'vertical', minHeight: '80px' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Initial Supply</label>
                  <input
                    type="number"
                    value={tokenData.supply}
                    onChange={(e) => handleInputChange('supply', parseInt(e.target.value) || 1000000)}
                    className={`w-full bg-slate-800/70 border ${validationErrors.supply ? 'border-red-500/70' : 'border-slate-600'
                      } rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent`}
                    min="1"
                    max="1000000000000"
                  />
                  {validationErrors.supply && <p className="text-red-400 text-sm mt-1">{validationErrors.supply}</p>}
                  <p className="text-sm text-slate-400 mt-1">Default: 1,000,000 tokens ({tokenData.decimals} decimals)</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Website</label>
                    <input
                      type="url"
                      placeholder="https://mytoken.com"
                      value={tokenData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      className={`w-full bg-slate-800/70 border ${validationErrors.website ? 'border-red-500/70' : 'border-slate-600'
                        } rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent`}
                    />
                    {validationErrors.website && <p className="text-red-400 text-sm mt-1">{validationErrors.website}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Telegram</label>
                    <input
                      type="text"
                      placeholder="t.me/mytoken"
                      value={tokenData.telegram}
                      onChange={(e) => handleInputChange('telegram', e.target.value)}
                      className="w-full bg-slate-800/70 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Twitter</label>
                    <input
                      type="text"
                      placeholder="@mytoken"
                      value={tokenData.twitter}
                      onChange={(e) => handleInputChange('twitter', e.target.value)}
                      className="w-full bg-slate-800/70 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setAdvancedMode(!advancedMode)}
                    className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    {advancedMode ? <ChevronDown size={16} /> : <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />}
                    {advancedMode ? 'Hide Advanced Options' : 'Show Advanced Options'}
                  </button>
                </div>
                {advancedMode && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
                    <h3 className="text-lg font-semibold text-blue-300 mb-3">Advanced Launch Options</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Decimals</label>
                        <select
                          value={tokenData.decimals}
                          onChange={(e) => handleInputChange('decimals', parseInt(e.target.value))}
                          className="w-full bg-slate-800/70 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                        >
                          <option value="6">6 (Standard)</option>
                          <option value="9">9 (Common)</option>
                          <option value="12">12 (DeFi)</option>
                          <option value="0">0 (No fractions)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Initial Price (USDC)</label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          value={tokenData.initialPrice}
                          onChange={(e) => handleInputChange('initialPrice', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/70 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Soft Cap (SOL)</label>
                        <input
                          type="number"
                          value={tokenData.softCap}
                          onChange={(e) => handleInputChange('softCap', parseFloat(e.target.value))}
                          min="1"
                          className="w-full bg-slate-800/70 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Hard Cap (SOL)</label>
                        <input
                          type="number"
                          value={tokenData.hardCap}
                          onChange={(e) => handleInputChange('hardCap', parseFloat(e.target.value))}
                          min="1"
                          className={`w-full bg-slate-800/70 border ${validationErrors.hardCap ? 'border-red-500/70' : 'border-slate-600'
                            } rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent`}
                        />
                        {validationErrors.hardCap && <p className="text-red-400 text-sm mt-1">{validationErrors.hardCap}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Liquidity %</label>
                        <input
                          type="number"
                          value={tokenData.liquidityPercentage}
                          onChange={(e) => handleInputChange('liquidityPercentage', parseInt(e.target.value))}
                          min="50"
                          max="100"
                          className={`w-full bg-slate-800/70 border ${validationErrors.liquidityPercentage ? 'border-red-500/70' : 'border-slate-600'
                            } rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent`}
                        />
                        {validationErrors.liquidityPercentage && (
                          <p className="text-red-400 text-sm mt-1">{validationErrors.liquidityPercentage}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Liquidity Lockup (days)</label>
                        <input
                          type="number"
                          value={tokenData.liquidityLockup}
                          onChange={(e) => handleInputChange('liquidityLockup', parseInt(e.target.value))}
                          min="30"
                          className="w-full bg-slate-800/70 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleLaunch}
                  disabled={!tokenData.name || !tokenData.symbol || isLaunching || !connected}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-white flex items-center justify-center gap-2 ${!tokenData.name || !tokenData.symbol || isLaunching || !connected
                      ? 'bg-slate-700 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 cursor-pointer'
                    }`}
                >
                  {isLaunching ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Launching...
                    </>
                  ) : (
                    <>
                      <Rocket size={18} />
                      Launch Token on {network.charAt(0).toUpperCase() + network.slice(1)}
                    </>
                  )}
                </button>
                <div className="text-center">
                  <p className="text-sm text-yellow-400">Required: Connect wallet + Fill name & symbol</p>
                  <p className={`text-sm mt-1 ${network === 'mainnet' ? 'text-red-400' : 'text-blue-400'}`}>
                    Cost: ~{network === 'mainnet' ? '0.01 SOL' : '0.01 SOL (free from faucet)'} for deployment
                  </p>
                  {launchStatus && (
                    <p
                      className={`text-sm mt-3 font-medium ${launchStatus.includes('Error') || launchStatus.includes('Please') || launchStatus.includes('failed') || launchStatus.includes('Insufficient')
                          ? 'text-red-400'
                          : launchStatus.includes('success') || launchStatus.includes('created') || launchStatus.includes('Connected')
                            ? 'text-green-400'
                            : 'text-blue-300'
                        }`}
                    >
                      {launchStatus}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-8">
              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                  <BarChart3 size={24} className="text-violet-400" />
                  Token Creation
                </h2>
                <div className="mb-6">
                  <BondingCurveChart />
                </div>
                <div className="space-y-6">
                  <div className="bg-slate-800/50 border border-blue-500/20 p-5 rounded-lg">
                    <h3 className="text-blue-400 mb-3 text-lg font-semibold">How It Works:</h3>
                    <ul className="space-y-2 text-slate-300">
                      <li className="flex items-start gap-2">
                        <div className="rounded-full bg-blue-500/20 p-1 mt-0.5">
                          <CheckCircle size={14} className="text-blue-400" />
                        </div>
                        <span>Creates actual SPL tokens on Solana blockchain</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="rounded-full bg-blue-500/20 p-1 mt-0.5">
                          <CheckCircle size={14} className="text-blue-400" />
                        </div>
                        <span>Adds metadata for token identity</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="rounded-full bg-blue-500/20 p-1 mt-0.5">
                          <CheckCircle size={14} className="text-blue-400" />
                        </div>
                        <span>Mints initial supply to your wallet</span>
                      </li>
                    </ul>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/40 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-400">{tokenData.hardCap} SOL</div>
                      <div className="text-sm text-slate-400">Hard Cap</div>
                    </div>
                    <div className="bg-slate-800/40 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-violet-400">${formatPrice(tokenData.initialPrice)}</div>
                      <div className="text-sm text-slate-400">Starting Price</div>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 p-5 rounded-lg">
                    <h3 className="text-lg font-semibold text-violet-400 mb-4">Preview</h3>
                    <div className="flex items-center gap-4 mb-4">
                      {mediaPreview ? (
                        <img src={mediaPreview} alt="Token Preview" className="w-16 h-16 rounded-full object-cover" />
                      ) : (
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full flex items-center justify-center">
                          <Rocket size={24} className="text-white" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-lg">{tokenData.name || 'Token Name'}</p>
                        <p className="text-slate-400">${tokenData.symbol || 'SYMBOL'}</p>
                      </div>
                    </div>
                    <div className="text-slate-300 space-y-1.5">
                      <p className="flex justify-between">
                        <span className="text-slate-400">Supply:</span>
                        <span>{tokenData.supply ? parseInt(tokenData.supply).toLocaleString() : '1,000,000'} tokens</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-400">Description:</span>
                        <span className="text-right">{tokenData.description || 'No description provided'}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-400">Network:</span>
                        <span className={network === 'mainnet' ? 'text-red-400' : 'text-blue-400'}>{network.toUpperCase()}</span>
                      </p>
                      {advancedMode && (
                        <>
                          <p className="flex justify-between">
                            <span className="text-slate-400">Initial Price:</span>
                            <span>${formatPrice(tokenData.initialPrice)}</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-slate-400">Liquidity:</span>
                            <span>{tokenData.liquidityPercentage}% locked for {tokenData.liquidityLockup} days</span>
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monitor' && (
          <div>
            {launchedTokens.length === 0 ? (
              <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <Rocket size={64} className="mx-auto mb-4 text-slate-500" />
                <h3 className="text-2xl font-bold text-slate-300 mb-2">No tokens launched yet</h3>
                <p className="text-slate-400 mb-6">Create your first token to see it here!</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-violet-600 rounded-lg font-medium text-white inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  Launch Your First Token
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50 h-fit lg:sticky lg:top-24">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Users size={18} className="text-violet-400" />
                    Your Tokens
                  </h2>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {launchedTokens.map((token) => (
                      <div
                        key={token.id}
                        onClick={() => setSelectedToken(token)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${selectedToken?.id === token.id
                            ? 'border-2 border-violet-500 bg-violet-500/10'
                            : 'border border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                          }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            {token.image && <img src={token.image} alt={token.name} className="w-8 h-8 rounded-full object-cover" />}
                            <div>
                              <h3 className="font-semibold">{token.name}</h3>
                              <p className="text-sm text-slate-400">${token.symbol}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-blue-400">${formatPrice(token.currentPrice)}</div>
                            <div className="text-xs text-slate-400">${formatNumber(token.marketCap)} MC</div>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-slate-700 rounded-full mb-2">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                            style={{ width: `${token.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>{token.progress}% complete</span>
                          <span>{token.holders} holders</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedToken && (
                  <div className="lg:col-span-3 space-y-6">
                    <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
                      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-6">
                        <div className="flex items-center gap-4">
                          {selectedToken.image ? (
                            <img src={selectedToken.image} alt={selectedToken.name} className="w-16 h-16 rounded-full object-cover" />
                          ) : (
                            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full flex items-center justify-center">
                              <Rocket size={24} className="text-white" />
                            </div>
                          )}
                          <div>
                            <h1 className="text-2xl font-bold mb-1">{selectedToken.name}</h1>
                            <p className="text-slate-300 text-lg">${selectedToken.symbol}</p>
                            {selectedToken.description && <p className="text-slate-400 mt-2 max-w-lg">{selectedToken.description}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-blue-400 mb-1">${formatPrice(selectedToken.currentPrice)}</div>
                          <div className="text-slate-300">MC: ${formatNumber(selectedToken.marketCap)}</div>
                        </div>
                      </div>
                      <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold">Progress</span>
                          <span className="text-slate-300">{selectedToken.progress}% complete</span>
                        </div>
                        <div className="w-full h-2 bg-slate-700 rounded-full">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500"
                            style={{ width: `${selectedToken.progress}%` }}
                          />
                        </div>
                        <div className="text-sm text-slate-400 mt-1.5">Target: {tokenData.hardCap} SOL</div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => copyToClipboard(selectedToken.id, 'address')}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white transition-colors"
                        >
                          {copied === 'address' ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
                          {copied === 'address' ? 'Copied!' : 'Copy Address'}
                        </button>
                        <a
                          href={`https://explorer.solana.com/address/${selectedToken.id}${selectedToken.network === 'devnet' ? '?cluster=devnet' : ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-slate-717 hover:bg-slate-600 border border-slate-600 rounded-lg text-white transition-colors"
                        >
                          <ExternalLink size={16} />
                          Explorer
                        </a>
                        {selectedToken.website && (
                          <a
                            href={selectedToken.website.startsWith('http') ? selectedToken.website : `https://${selectedToken.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white transition-colors"
                          >
                            <Globe size={16} />
                            Website
                          </a>
                        )}
                        {selectedToken.telegram && (
                          <a
                            href={selectedToken.telegram.startsWith('http') ? selectedToken.telegram : `https://${selectedToken.telegram}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white transition-colors"
                          >
                            <MessageCircle size={16} />
                            Telegram
                          </a>
                        )}
                        {selectedToken.twitter && (
                          <a
                            href={selectedToken.twitter.startsWith('http') ? selectedToken.twitter : `https://x.com/${selectedToken.twitter.replace('@', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white transition-colors"
                          >
                            <Twitter size={16} />
                            Twitter
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-pink-500 to-violet-500 flex items-center justify-center">
                            <Users size={16} className="text-white" />
                          </div>
                          <span className="text-slate-400 text-sm">Holders</span>
                        </div>
                        <div className="text-xl font-bold text-pink-400">{formatNumber(selectedToken.holders)}</div>
                      </div>
                      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 flex items-center justify-center">
                            <TrendingUp size={16} className="text-white" />
                          </div>
                          <span className="text-slate-400 text-sm">Supply</span>
                        </div>
                        <div className="text-xl font-bold text-violet-400">{formatNumber(selectedToken.supply)}</div>
                      </div>
                      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-pink-500 flex items-center justify-center">
                            <Rocket size={16} className="text-white" />
                          </div>
                          <span className="text-slate-400 text-sm">Age</span>
                        </div>
                        <div className="text-xl font-bold text-blue-400">
                          {Math.floor((Date.now() - selectedToken.createdAt) / (1000 * 60 * 60))}h
                        </div>
                      </div>
                    </div>
                    <div className={`rounded-xl p-6 border ${selectedToken.network === 'mainnet' ? 'bg-green-900/10 border-green-600/50' : 'bg-blue-900/10 border-blue-600/50'}`}>
                      <h3 className={`text-xl font-bold mb-5 flex items-center gap-2 ${selectedToken.network === 'mainnet' ? 'text-green-400' : 'text-blue-400'}`}>
                        <Award size={18} />
                        Token Successfully Launched!
                      </h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-4">
                          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
                            <h4 className="font-semibold text-blue-400 mb-3">Contract Addresses:</h4>
                            <div className="space-y-4 text-sm">
                              <div>
                                <p className="text-slate-300 mb-1">Mint Address:</p>
                                <div className="flex items-center gap-2">
                                  <div className="bg-slate-800 p-2.5 rounded border border-slate-700 font-mono text-xs break-all flex-1">
                                    {selectedToken.id}
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(selectedToken.id, 'mint')}
                                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-md"
                                  >
                                    {copied === 'mint' ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
                            <h4 className="font-semibold text-blue-400 mb-3">Token Information:</h4>
                            <div className="bg-slate-800/70 p-4 rounded-lg border border-slate-700 space-y-2">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Network:</span>
                                <span className={selectedToken.network === 'mainnet' ? 'text-red-400 font-semibold' : 'text-blue-400 font-semibold'}>
                                  {selectedToken.network.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Token Standard:</span>
                                <span>SPL-Token</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Created On:</span>
                                <span>{selectedToken.createdAt.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Decimals:</span>
                                <span>{tokenData.decimals}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
                            <h4 className="font-semibold text-blue-400 mb-3">View Token:</h4>
                            <div className="space-y-2">
                              <a
                                href={`https://explorer.solana.com/address/${selectedToken.id}${selectedToken.network === 'devnet' ? '?cluster=devnet' : ''}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex samples-center justify-between w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <ExternalLink size={16} />
                                  Solana Explorer
                                </span>
                                <ArrowRight size={16} />
                              </a>
                              <a
                                href={`https://solscan.io/token/${selectedToken.id}${selectedToken.network === 'devnet' ? '?cluster=devnet' : ''}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <ExternalLink size={16} />
                                  Solscan
                                </span>
                                <ArrowRight size={16} />
                              </a>
                            </div>
                          </div>
                          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
                            <h4 className="font-semibold text-blue-400 mb-3">Security Features:</h4>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 p-2 bg-slate-800/50 border border-slate-700/50 rounded-md">
                                <ShieldCheck size={16} className="text-blue-400" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">Mint Authority</p>
                                  <p className="text-xs text-slate-400">You control token minting</p>
                                </div>
                                <Lock size={16} className="text-green-400" />
                              </div>
                              <div className="flex items-center gap-2 p-2 bg-slate-800/50 border border-slate-700/50 rounded-md">
                                <ShieldCheck size={16} className="text-blue-400" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">Freeze Authority</p>
                                  <p className="text-xs text-slate-400">You can freeze token accounts</p>
                                </div>
                                <Lock size={16} className="text-green-400" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {selectedToken.network === 'devnet' && (
                        <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-600/30 text-center">
                          <p className="text-blue-300 font-semibold mb-1">Devnet Token With Real Blockchain Integration</p>
                          <p className="text-blue-200/70 text-sm">
                            This token exists on Solana's devnet blockchain and can be viewed in block explorers.
                            Switch to Mainnet to create a token with actual economic value.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AppWrapper;