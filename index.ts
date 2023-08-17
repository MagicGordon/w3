import { Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL, Connection, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import { MINT_SIZE, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createInitializeMintInstruction, getMinimumBalanceForRentExemptMint, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createMintToInstruction, createTransferInstruction } from '@solana/spl-token';
import * as fs from 'fs';

const sleep = async(ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}
const main = async() => {
    const solanaConnection = new Connection('https://api.devnet.solana.com');
    const aliceWallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('alice.json').toString())));
    const bobWallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('bob.json').toString())));
    console.log("Alice publicKey: ", aliceWallet.publicKey.toString())
    console.log("Bob publicKey: ", bobWallet.publicKey.toString())
    
    let mintKeypair = Keypair.generate();   
    console.log(`New Mint Address: `, mintKeypair.publicKey.toString());
    //Get the minimum lamport balance to create a new account and avoid rent payments
    const requiredBalance = await getMinimumBalanceForRentExemptMint(solanaConnection);
    //get associated token account of your wallet
    const aliceTokenATA = await getAssociatedTokenAddress(mintKeypair.publicKey, aliceWallet.publicKey);  
    const bobTokenATA = await getAssociatedTokenAddress(mintKeypair.publicKey, bobWallet.publicKey);  

    console.log("aliceTokenATA:", aliceTokenATA.toBase58())
    console.log("bobTokenATA:", bobTokenATA.toBase58())

    const createNewTokenTransaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: aliceWallet.publicKey,
            newAccountPubkey: mintKeypair.publicKey,
            space: MINT_SIZE,
            lamports: requiredBalance,
            programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey, //Mint Address
          6, //Number of Decimals of New mint
          aliceWallet.publicKey, //Mint Authority
          aliceWallet.publicKey, //Freeze Authority
          TOKEN_PROGRAM_ID),
    );

    const mintToAliceTransaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          aliceWallet.publicKey, //Payer 
          aliceTokenATA, //Associated token account 
          aliceWallet.publicKey, //token owner
          mintKeypair.publicKey, //Mint
        ),
        createMintToInstruction(
          mintKeypair.publicKey, //Mint
          aliceTokenATA, //Destination Token Account
          aliceWallet.publicKey, //Authority
          10 * Math.pow(10, 6),//number of tokens
        ),
    );

    const transferToBobTransaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          aliceWallet.publicKey, //Payer 
          bobTokenATA, //Associated token account 
          bobWallet.publicKey, //token owner
          mintKeypair.publicKey, //Mint
        ),
        createTransferInstruction(
          aliceTokenATA, //Source account
          bobTokenATA, //Destination account
          aliceWallet.publicKey, //Owner of the source account
          1 * Math.pow(10, 6),//number of tokens
        ),
    );

    {
        let { lastValidBlockHeight, blockhash } = await solanaConnection.getLatestBlockhash('finalized');
        createNewTokenTransaction.recentBlockhash = blockhash;
        createNewTokenTransaction.lastValidBlockHeight = lastValidBlockHeight;
        createNewTokenTransaction.feePayer = aliceWallet.publicKey;
        const transactionId = await sendAndConfirmTransaction(solanaConnection, createNewTokenTransaction, [aliceWallet, mintKeypair]); 
        console.log(`Transaction ID: `, transactionId);
        console.log(`Succesfully created ${mintKeypair.publicKey} Token.`);
    }
    await sleep(15000)
    {
        let { lastValidBlockHeight, blockhash } = await solanaConnection.getLatestBlockhash('finalized');
        mintToAliceTransaction.recentBlockhash = blockhash;
        mintToAliceTransaction.lastValidBlockHeight = lastValidBlockHeight;
        mintToAliceTransaction.feePayer = aliceWallet.publicKey;
        const transactionId = await sendAndConfirmTransaction(solanaConnection, mintToAliceTransaction, [aliceWallet]);
        console.log(`Transaction ID: `, transactionId);
        console.log(`Succesfully minted ${10} ${mintKeypair.publicKey} to ${aliceWallet.publicKey.toString()}.`);
        
    }
    await sleep(15000)
    solanaConnection.getTokenAccountBalance(aliceTokenATA).then((balance) => {
      console.log(`Alice current token balance: `, balance);
    })
    {
        let { lastValidBlockHeight, blockhash } = await solanaConnection.getLatestBlockhash('finalized');
        transferToBobTransaction.recentBlockhash = blockhash;
        transferToBobTransaction.lastValidBlockHeight = lastValidBlockHeight;
        transferToBobTransaction.feePayer = aliceWallet.publicKey;
        const transactionId = await sendAndConfirmTransaction(solanaConnection, transferToBobTransaction, [aliceWallet]);
        console.log(`Transaction ID: `, transactionId);
        console.log(`Succesfully from ${aliceWallet.publicKey.toString()} transfer ${1} ${mintKeypair.publicKey} to ${bobWallet.publicKey.toString()}.`);
    }
    await sleep(15000)

    solanaConnection.getTokenAccountBalance(aliceTokenATA).then((balance) => {
        console.log(`Alice current token balance: `, balance);
    })
    solanaConnection.getTokenAccountBalance(bobTokenATA).then((balance) => {
        console.log(`Bob current token balance: `, balance);
    })
}

main()