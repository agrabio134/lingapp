import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAccount,
} from '@solana/spl-token';
import {
  DollarSign, TrendingUp, ExternalLink, ArrowRight, AlertCircle,
  BarChart3, RefreshCw, Copy, CheckCircle, Wallet, Plus
} from 'lucide-react';

const RPC_CONFIG = {
  devnet: 'https://api.devnet.solana.com',
  mainnet: 'https://solana-mainnet.g.alchemy.com/v2/FKINhha0yp9CvQeOTYjq4',
};

const Trade = ({ network = 'mainnet', launchedTokens = [] }) => {
  const { publicKey, connected, signTransaction } = useWallet();
  
  // State
  const [tradeMode, setTradeMode] = useState('buy');
  const [tradeAmount, setTradeAmount] = useState('');
  const [selectedTradeToken, setSelectedTradeToken] = useState('');
  const [tokenBalance, setTokenBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [isTrading, setIsTrading] = useState(false);
  const [tradeStatus, setTradeStatus] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState('');
  const [autoDetectedTokens, setAutoDetectedTokens] = useState([]);

  // Auto-detect tokens from wallet
  useEffect(() => {
    const detectTokens = async () => {
      if (!connected || !publicKey) return;
      
      try {
        const connection = new Connection(RPC_CONFIG[network], 'confirmed');
        
        // Get all token accounts for the wallet
        const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        });
        
        const tokens = [];
        for (const { account, pubkey } of tokenAccounts.value) {
          const accountInfo = account.data;
          // Parse token account data (simplified)
          if (accountInfo.length >= 72) {
            const mint = new PublicKey(accountInfo.slice(0, 32));
            const amount = accountInfo.readBigUInt64LE(64);
            
            if (amount > 0) {
              tokens.push({
                mint: mint.toString(),
                amount: Number(amount),
                accountAddress: pubkey.toString()
              });
            }
          }
        }
        
        setAutoDetectedTokens(tokens);
      } catch (error) {
        console.error('Failed to detect tokens:', error);
      }
    };
    
    if (connected) {
      detectTokens();
    }
  }, [connected, publicKey, network]);

  // Fetch balances
  const fetchBalances = async () => {
    if (!connected || !publicKey) return;
    
    setIsRefreshing(true);
    try {
      const connection = new Connection(RPC_CONFIG[network], 'confirmed');
      
      // Get SOL balance
      const solBal = await connection.getBalance(publicKey);
      setSolBalance(solBal / LAMPORTS_PER_SOL);
      
      // Get token balance if a token is selected
      if (selectedTradeToken) {
        try {
          const tokenMint = new PublicKey(selectedTradeToken);
          const associatedTokenAccount = getAssociatedTokenAddressSync(tokenMint, publicKey);
          const tokenAccount = await getAccount(connection, associatedTokenAccount);
          setTokenBalance(Number(tokenAccount.amount) / Math.pow(10, 9));
        } catch (error) {
          setTokenBalance(0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      setTradeStatus('Failed to fetch balances. Check your connection.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle trade
  const handleTrade = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setTradeStatus('Connect wallet first');
      return;
    }
    
    if (!selectedTradeToken) {
      setTradeStatus('Select a token to trade');
      return;
    }
    
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      setTradeStatus('Enter a valid amount');
      return;
    }
    
    setIsTrading(true);
    setTradeStatus('Processing trade...');
    
    try {
      const connection = new Connection(RPC_CONFIG[network], 'confirmed');
      const tokenMint = new PublicKey(selectedTradeToken);
      const associatedTokenAccount = getAssociatedTokenAddressSync(tokenMint, publicKey);
      
      const transaction = new Transaction();
      
      if (tradeMode === 'buy') {
        // Create associated token account if it doesn't exist
        try {
          await getAccount(connection, associatedTokenAccount);
        } catch (error) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              associatedTokenAccount,
              publicKey,
              tokenMint
            )
          );
        }
        
        // Mint tokens (demo - only works if you're the mint authority)
        const amount = parseFloat(tradeAmount) * Math.pow(10, 9);
        transaction.add(
          createMintToInstruction(
            tokenMint,
            associatedTokenAccount,
            publicKey,
            BigInt(amount)
          )
        );
        
      } else {
        setTradeStatus('Sell functionality requires liquidity pools on Jupiter or Raydium.');
        setIsTrading(false);
        return;
      }
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      const signedTransaction = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
      
      setTradeStatus(`Demo mint successful! Signature: ${signature.slice(0, 20)}...`);
      setTimeout(fetchBalances, 2000);
      
    } catch (error) {
      console.error('Trade error:', error);
      if (error.message.includes('mint authority')) {
        setTradeStatus('Demo minting failed: You are not the mint authority for this token. Use Jupiter or Raydium for real trading.');
      } else {
        setTradeStatus(`Trade failed: ${error.message}`);
      }
    } finally {
      setIsTrading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  // Format number
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(2);
  };

  // Auto-fetch balances
  useEffect(() => {
    if (connected && publicKey) {
      fetchBalances();
    }
  }, [connected, publicKey, selectedTradeToken, network]);

  // Combine launched tokens and auto-detected tokens
  const allTokens = [
    ...launchedTokens.map(token => ({
      id: token.id,
      name: token.name,
      symbol: token.symbol,
      type: 'launched',
      image: token.image
    })),
    // Add your specific MAINNET token
    {
      id: '67iGgyUWAXrZhpq2NkpAUdZTTpaEdoRrj6iG4VZMYDgH',
      name: 'TESTTOKEN',
      symbol: 'MAINNET',
      type: 'manual',
      image: null
    },
    ...autoDetectedTokens.map(token => ({
      id: token.mint,
      name: `Token ${token.mint.slice(0, 8)}...`,
      symbol: 'AUTO',
      type: 'detected',
      amount: token.amount
    }))
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trading Interface */}
        <div className="lg:col-span-2 bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <DollarSign size={24} className="text-green-400" />
              Token Trading
            </h2>
            <button
              onClick={fetchBalances}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          
          {!connected ? (
            <div className="text-center py-12">
              <Wallet size={48} className="mx-auto mb-4 text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-300 mb-2">Connect Your Wallet</h3>
              <p className="text-slate-400">Connect your wallet to start trading tokens</p>
            </div>
          ) : (
            <>
              {/* Balance Display */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                  <div className="text-sm text-slate-400 mb-1">SOL Balance</div>
                  <div className="text-xl font-bold text-blue-400">{solBalance.toFixed(4)} SOL</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                  <div className="text-sm text-slate-400 mb-1">Token Balance</div>
                  <div className="text-xl font-bold text-green-400">{formatNumber(tokenBalance)}</div>
                </div>
              </div>

              {/* Trade Mode Selection */}
              <div className="flex bg-slate-800/50 rounded-lg p-1 mb-6 border border-slate-700">
                <button
                  onClick={() => setTradeMode('buy')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                    tradeMode === 'buy'
                      ? 'bg-green-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Buy/Mint Tokens
                </button>
                <button
                  onClick={() => setTradeMode('sell')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                    tradeMode === 'sell'
                      ? 'bg-red-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sell Tokens
                </button>
              </div>

              {/* Token Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Token ({allTokens.length} available)
                </label>
                <select
                  value={selectedTradeToken}
                  onChange={(e) => setSelectedTradeToken(e.target.value)}
                  className="w-full bg-slate-800/70 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                >
                  <option value="">Select a token to trade</option>
                  {allTokens.map((token) => (
                    <option key={token.id} value={token.id}>
                      {token.name} ({token.symbol}) - {token.type}
                    </option>
                  ))}
                </select>
                {selectedTradeToken && (
                  <div className="mt-2 p-2 bg-slate-800/50 rounded border border-slate-700">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Selected Token:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{selectedTradeToken.slice(0, 20)}...</span>
                        <button
                          onClick={() => copyToClipboard(selectedTradeToken, 'token')}
                          className="p-1 hover:bg-slate-700 rounded"
                        >
                          {copied === 'token' ? (
                            <CheckCircle size={14} className="text-green-400" />
                          ) : (
                            <Copy size={14} className="text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Amount Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Amount {tradeMode === 'buy' ? 'to Buy/Mint' : 'to Sell'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  placeholder={`Enter ${tradeMode === 'buy' ? 'tokens to mint' : 'tokens to sell'}`}
                  className="w-full bg-slate-800/70 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex gap-2 mb-6">
                {['10', '100', '1000', 'Max'].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      if (amount === 'Max') {
                        setTradeAmount(tradeMode === 'buy' ? '10000' : tokenBalance.toString());
                      } else {
                        setTradeAmount(amount);
                      }
                    }}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-md text-sm text-slate-300 hover:text-white transition-colors"
                  >
                    {amount}
                  </button>
                ))}
              </div>

              {/* Trade Button */}
              <button
                onClick={handleTrade}
                disabled={!selectedTradeToken || !tradeAmount || isTrading}
                className={`w-full py-3 px-4 rounded-lg font-semibold text-white flex items-center justify-center gap-2 ${
                  !selectedTradeToken || !tradeAmount || isTrading
                    ? 'bg-slate-700 cursor-not-allowed opacity-60'
                    : tradeMode === 'buy'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'
                    : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500'
                }`}
              >
                {isTrading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Trading...
                  </>
                ) : (
                  <>
                    <DollarSign size={18} />
                    {tradeMode === 'buy' ? 'Demo Mint' : 'Sell Tokens'}
                  </>
                )}
              </button>

              {/* Status Messages */}
              {tradeStatus && (
                <div className={`mt-4 p-3 rounded-lg border text-sm ${
                  tradeStatus.includes('successful') || tradeStatus.includes('Signature')
                    ? 'bg-green-900/20 border-green-600/30 text-green-300'
                    : tradeStatus.includes('failed') || tradeStatus.includes('error')
                    ? 'bg-red-900/20 border-red-600/30 text-red-300'
                    : 'bg-blue-900/20 border-blue-600/30 text-blue-300'
                }`}>
                  {tradeStatus}
                </div>
              )}
            </>
          )}
        </div>

        {/* Trading Info Sidebar */}
        <div className="space-y-6">
          {/* Real Trading Links */}
          <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
              <TrendingUp size={20} className="text-violet-400" />
              Real Trading
            </h3>
            <div className="space-y-3">
              <a
                href={`https://jup.ag/swap/SOL-67iGgyUWAXrZhpq2NkpAUdZTTpaEdoRrj6iG4VZMYDgH`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg hover:from-purple-600/30 hover:to-blue-600/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                    <ExternalLink size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Jupiter</p>
                    <p className="text-xs text-slate-400">Trade MAINNET</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-400" />
              </a>
              
              <a
                href={`https://raydium.io/swap/?inputCurrency=sol&outputCurrency=67iGgyUWAXrZhpq2NkpAUdZTTpaEdoRrj6iG4VZMYDgH`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-lg hover:from-blue-600/30 hover:to-cyan-600/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                    <ExternalLink size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Raydium</p>
                    <p className="text-xs text-slate-400">Create pools</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-400" />
              </a>
            </div>
          </div>

          {/* Token Discovery */}
          <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-400" />
              Your Tokens ({allTokens.length})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allTokens.length === 0 ? (
                <p className="text-slate-400 text-sm">No tokens found. Launch a token or connect a wallet with tokens.</p>
              ) : (
                allTokens.map((token) => (
                  <div
                    key={token.id}
                    onClick={() => setSelectedTradeToken(token.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedTradeToken === token.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{token.name}</p>
                        <p className="text-xs text-slate-400">{token.symbol} • {token.type}</p>
                      </div>
                      <div className="text-xs text-slate-400">
                        {token.id.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Demo Notice */}
          <div className="bg-yellow-900/20 p-4 rounded-lg border border-yellow-600/30">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-yellow-400 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-300 mb-2">Demo Trading</p>
                <p className="text-yellow-200/80 text-sm">
                  This interface demonstrates token minting. For real trading with price discovery, use Jupiter or Raydium with liquidity pools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Trade;