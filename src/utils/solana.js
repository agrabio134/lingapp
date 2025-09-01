import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

// Connect to devnet
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

export async function createCoin(wallet) {
  if (!wallet?.publicKey) {
    throw new Error("Wallet not connected");
  }

  try {
    // 1. Create new token mint
    const mint = await createMint(
      connection,
      wallet,               // payer
      wallet.publicKey,     // mint authority
      null,                 // freeze authority
      9                     // decimals
    );

    console.log("✅ Mint created:", mint.toBase58());

    // 2. Get or create associated token account for wallet
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,            // payer
      mint,              // mint address
      wallet.publicKey   // owner of token account
    );

    console.log("✅ Token Account:", tokenAccount.address.toBase58());

    // 3. Mint 1,000 tokens to wallet
    await mintTo(
      connection,
      wallet,
      mint,
      tokenAccount.address,
      wallet.publicKey,
      1_000 * 10 ** 9 // decimals = 9
    );

    console.log("✅ Minted 1000 tokens to:", tokenAccount.address.toBase58());

    return mint.toBase58();
  } catch (err) {
    console.error("❌ Error creating token:", err);
    throw err;
  }
}
