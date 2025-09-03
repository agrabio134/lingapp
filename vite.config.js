import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      buffer: true,
      crypto: true,
      process: true,
    }),
  ],
  optimizeDeps: {
    include: [
      '@solana/web3.js',
      '@solana/spl-token',
      '@metaplex-foundation/js',
      '@solana/wallet-adapter-base',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-wallets',
      '@raydium-io/raydium-sdk',
      'lucide-react',
      'buffer',
      'crypto-browserify',
      'stream-browserify',
    ],
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
});