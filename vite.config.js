import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  define: {
    global: 'window',
    'process.env': {},
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    include: [
      '@solana/web3.js',
      '@solana/spl-token',
      '@metaplex-foundation/umi',
      '@metaplex-foundation/umi-bundle-defaults',
      '@metaplex-foundation/mpl-token-metadata',
      '@metaplex-foundation/umi-uploader-irys',
      '@metaplex-foundation/umi-signer-wallet-adapters',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-wallets',
      'web3.storage',
      'buffer',
    ],
  },
  build: {
    minify: 'esbuild',
    sourcemap: false,
  },
});