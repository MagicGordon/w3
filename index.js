"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const fs = __importStar(require("fs"));
const sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
const main = async () => {
    const solanaConnection = new web3_js_1.Connection('https://api.devnet.solana.com');
    const aliceWallet = web3_js_1.Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('alice.json').toString())));
    const bobWallet = web3_js_1.Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('bob.json').toString())));
    console.log("Alice publicKey: ", aliceWallet.publicKey.toString());
    console.log("Bob publicKey: ", bobWallet.publicKey.toString());
    let mintKeypair = web3_js_1.Keypair.generate();
    console.log(`New Mint Address: `, mintKeypair.publicKey.toString());
    //Get the minimum lamport balance to create a new account and avoid rent payments
    const requiredBalance = await (0, spl_token_1.getMinimumBalanceForRentExemptMint)(solanaConnection);
    //get associated token account of your wallet
    const aliceTokenATA = await (0, spl_token_1.getAssociatedTokenAddress)(mintKeypair.publicKey, aliceWallet.publicKey);
    const bobTokenATA = await (0, spl_token_1.getAssociatedTokenAddress)(mintKeypair.publicKey, bobWallet.publicKey);
    console.log("aliceTokenATA:", aliceTokenATA.toBase58());
    console.log("bobTokenATA:", bobTokenATA.toBase58());
    const createNewTokenTransaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.createAccount({
        fromPubkey: aliceWallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: spl_token_1.MINT_SIZE,
        lamports: requiredBalance,
        programId: spl_token_1.TOKEN_PROGRAM_ID,
    }), (0, spl_token_1.createInitializeMintInstruction)(mintKeypair.publicKey, //Mint Address
    6, //Number of Decimals of New mint
    aliceWallet.publicKey, //Mint Authority
    aliceWallet.publicKey, //Freeze Authority
    spl_token_1.TOKEN_PROGRAM_ID));
    const mintToAliceTransaction = new web3_js_1.Transaction().add((0, spl_token_1.createAssociatedTokenAccountInstruction)(aliceWallet.publicKey, //Payer 
    aliceTokenATA, //Associated token account 
    aliceWallet.publicKey, //token owner
    mintKeypair.publicKey), (0, spl_token_1.createMintToInstruction)(mintKeypair.publicKey, //Mint
    aliceTokenATA, //Destination Token Account
    aliceWallet.publicKey, //Authority
    10 * Math.pow(10, 6)));
    const transferToBobTransaction = new web3_js_1.Transaction().add((0, spl_token_1.createAssociatedTokenAccountInstruction)(aliceWallet.publicKey, //Payer 
    bobTokenATA, //Associated token account 
    bobWallet.publicKey, //token owner
    mintKeypair.publicKey), (0, spl_token_1.createTransferInstruction)(aliceTokenATA, //Source account
    bobTokenATA, //Destination account
    aliceWallet.publicKey, //Owner of the source account
    1 * Math.pow(10, 6)));
    {
        let { lastValidBlockHeight, blockhash } = await solanaConnection.getLatestBlockhash('finalized');
        createNewTokenTransaction.recentBlockhash = blockhash;
        createNewTokenTransaction.lastValidBlockHeight = lastValidBlockHeight;
        createNewTokenTransaction.feePayer = aliceWallet.publicKey;
        const transactionId = await (0, web3_js_1.sendAndConfirmTransaction)(solanaConnection, createNewTokenTransaction, [aliceWallet, mintKeypair]);
        console.log(`Transaction ID: `, transactionId);
        console.log(`Succesfully created ${mintKeypair.publicKey} Token.`);
    }
    await sleep(15000);
    {
        let { lastValidBlockHeight, blockhash } = await solanaConnection.getLatestBlockhash('finalized');
        mintToAliceTransaction.recentBlockhash = blockhash;
        mintToAliceTransaction.lastValidBlockHeight = lastValidBlockHeight;
        mintToAliceTransaction.feePayer = aliceWallet.publicKey;
        const transactionId = await (0, web3_js_1.sendAndConfirmTransaction)(solanaConnection, mintToAliceTransaction, [aliceWallet]);
        console.log(`Transaction ID: `, transactionId);
        console.log(`Succesfully minted ${10} ${mintKeypair.publicKey} to ${aliceWallet.publicKey.toString()}.`);
    }
    await sleep(15000);
    solanaConnection.getTokenAccountBalance(aliceTokenATA).then((balance) => {
        console.log(`Alice current token balance: `, balance);
    });
    {
        let { lastValidBlockHeight, blockhash } = await solanaConnection.getLatestBlockhash('finalized');
        transferToBobTransaction.recentBlockhash = blockhash;
        transferToBobTransaction.lastValidBlockHeight = lastValidBlockHeight;
        transferToBobTransaction.feePayer = aliceWallet.publicKey;
        const transactionId = await (0, web3_js_1.sendAndConfirmTransaction)(solanaConnection, transferToBobTransaction, [aliceWallet]);
        console.log(`Transaction ID: `, transactionId);
        console.log(`Succesfully from ${aliceWallet.publicKey.toString()} transfer ${1} ${mintKeypair.publicKey} to ${bobWallet.publicKey.toString()}.`);
    }
    await sleep(15000);
    // let allTransaction = new Transaction().add(
    //   SystemProgram.createAccount({
    //       fromPubkey: aliceWallet.publicKey,
    //       newAccountPubkey: mintKeypair.publicKey,
    //       space: MINT_SIZE,
    //       lamports: requiredBalance,
    //       programId: TOKEN_PROGRAM_ID,
    //   }),
    //   createInitializeMintInstruction(
    //     mintKeypair.publicKey, //Mint Address
    //     6, //Number of Decimals of New mint
    //     aliceWallet.publicKey, //Mint Authority
    //     aliceWallet.publicKey, //Freeze Authority
    //     TOKEN_PROGRAM_ID),
    //   createAssociatedTokenAccountInstruction(
    //     aliceWallet.publicKey, //Payer 
    //     aliceTokenATA, //Associated token account 
    //     aliceWallet.publicKey, //token owner
    //     mintKeypair.publicKey, //Mint
    //   ),
    //   createMintToInstruction(
    //     mintKeypair.publicKey, //Mint
    //     aliceTokenATA, //Destination Token Account
    //     aliceWallet.publicKey, //Authority
    //     10 * Math.pow(10, 6),//number of tokens
    //   ),
    //   createAssociatedTokenAccountInstruction(
    //     aliceWallet.publicKey, //Payer 
    //     bobTokenATA, //Associated token account 
    //     bobWallet.publicKey, //token owner
    //     mintKeypair.publicKey, //Mint
    //   ),
    //   createTransferInstruction(
    //     aliceTokenATA, //Source account
    //     bobTokenATA, //Destination account
    //     aliceWallet.publicKey, //Owner of the source account
    //     1 * Math.pow(10, 6),//number of tokens
    //   ),
    // );
    // {
    //   let { lastValidBlockHeight, blockhash } = await solanaConnection.getLatestBlockhash('finalized');
    //   allTransaction.recentBlockhash = blockhash;
    //   allTransaction.lastValidBlockHeight = lastValidBlockHeight;
    //   allTransaction.feePayer = aliceWallet.publicKey;
    //   const transactionId = await sendAndConfirmTransaction(solanaConnection, allTransaction, [aliceWallet, mintKeypair]);
    //   console.log(`Transaction ID: `, transactionId);
    //   console.log(`Succesfully all.`);
    // }
    // await sleep(10000)
    solanaConnection.getTokenAccountBalance(aliceTokenATA).then((balance) => {
        console.log(`Alice current token balance: `, balance);
    });
    solanaConnection.getTokenAccountBalance(bobTokenATA).then((balance) => {
        console.log(`Bob current token balance: `, balance);
    });
};
main();
