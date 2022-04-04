import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import {
  createMint,
  createMintAndVault,
  createMintInstructions,
  createTokenAccount,
  getMintInfo,
  getTokenAccount,
  NodeWallet,
} from "@project-serum/common";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import assert from "assert";
import * as solend from "@solendprotocol/solend-sdk";
import { VAULT_AUTHORITY } from "./constants";
import { bn, printObjectKeys, printProgramShortDetails } from "./utils";
import { createTrancheConfigInput, createTranchesConfiguration, findTrancheConfig } from "./vyper-core-utils";
import { SolendReserveAsset } from "../cf-sdk/src/adapters/solend";
import { mintTo } from "@project-serum/serum/lib/token-instructions";

const DEVNET_SOLEND_PROGRAM_ID = new anchor.web3.PublicKey("ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx");

describe.only("vyper-core-lending-solend", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  //@ts-ignore
  const programVyperCoreLending = anchor.workspace.VyperCoreLending as Program<VyperCoreLending>;
  //@ts-ignore
  const programProxyLendingSolend = anchor.workspace.ProxyLendingSolend as Program<ProxyLendingSolend>;

  it("deposit as senior on lending protocol", async () => {
    // define input data
    const inputData = createTrancheConfigInput();
    const quantityToDeposit = 1000;

    // init SOLEND
    const solendInit = await initLendingMarkets();
    // printObjectKeys("solend reserve", solendInit.reserve.reserve.config);
    // console.log("reserve token owner: " + solendInit.owner.publicKey);
    // console.log("reserve token: " + solendInit.reserveToken);
    // console.log("owner reserve token: " + solendInit.ownerReserveTokenAccount);

    // mint reserve token to user wallet
    var userReserveTokenAccount = await createTokenAccount(
      programVyperCoreLending.provider,
      solendInit.reserveToken,
      programVyperCoreLending.provider.wallet.publicKey
    );

    const mintToTx = new anchor.web3.Transaction();
    mintToTx.add(
      Token.createMintToInstruction(
        TOKEN_PROGRAM_ID,
        solendInit.reserveToken,
        userReserveTokenAccount,
        programVyperCoreLending.provider.wallet.publicKey,
        [solendInit.owner],
        quantityToDeposit
      )
    );
    await programVyperCoreLending.provider.send(mintToTx, [solendInit.owner]);

    const userReserveTokenAccountInfo = await getTokenAccount(programVyperCoreLending.provider, userReserveTokenAccount);
    assert.equal(userReserveTokenAccountInfo.amount, quantityToDeposit);

    // initialize tranche config

    const { seniorTrancheMint, seniorTrancheMintBump, juniorTrancheMint, juniorTrancheMintBump } =
      await createTranchesConfiguration(programProxyLendingSolend.programId, solendInit.reserveToken, programVyperCoreLending);

    const [trancheConfig, trancheConfigBump] = await findTrancheConfig(
      solendInit.reserveToken,
      seniorTrancheMint,
      juniorTrancheMint,
      programVyperCoreLending.programId
    );

    // vyper-core rpc: create tranche

    const tx = await programVyperCoreLending.rpc.createTranche(
      inputData,
      trancheConfigBump,
      seniorTrancheMintBump,
      juniorTrancheMintBump,
      {
        accounts: {
          authority: programVyperCoreLending.provider.wallet.publicKey,
          trancheConfig,
          mint: solendInit.reserveToken,
          seniorTrancheMint: seniorTrancheMint,
          juniorTrancheMint: juniorTrancheMint,
          proxyProtocolProgram: programProxyLendingSolend.programId,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        },
      }
    );

    const seniorTrancheVault = await createTokenAccount(
      programVyperCoreLending.provider,
      seniorTrancheMint,
      programVyperCoreLending.provider.wallet.publicKey
    );
    const juniorTrancheVault = await createTokenAccount(
      programVyperCoreLending.provider,
      juniorTrancheMint,
      programVyperCoreLending.provider.wallet.publicKey
    );

    const [vaultAuthority, vaultAuthorityBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(VAULT_AUTHORITY), trancheConfig.toBuffer()],
      programVyperCoreLending.programId
    );

    const userCollateralTokenAccount = await createTokenAccount(
      programVyperCoreLending.provider,
      new anchor.web3.PublicKey(solendInit.reserve.reserve.config.collateralMintAddress),
      vaultAuthority
    );

    // deposit on lending protocol

    const seniorTrancheMintQuantity = 150;
    const juniorTrancheMintQuantity = 50;

    // console.log("protocol program: " + DEVNET_SOLEND_PROGRAM_ID);
    // console.log("trancheConfig: " + trancheConfig);
    // console.log("userReserveTokenAccount: " + userReserveTokenAccount);
    // console.log("vaultAuthority: " + vaultAuthority);
    // console.log("userCollateralTokenAccount: " + userCollateralTokenAccount);
    // console.log("seniorTrancheMint: " + seniorTrancheMint);
    // console.log("seniorTrancheVault: " + seniorTrancheVault);
    // console.log("juniorTrancheMint: " + juniorTrancheMint);
    // console.log("juniorTrancheVault: " + juniorTrancheVault);
    // printObjectKeys("solend reserve", solendInit.reserve.reserve.config);

    // console.log("programVyperCoreLending.rpc.deposit account: " + programVyperCoreLending.provider.wallet.publicKey);
    // console.log("programVyperCoreLending.rpc.deposit account: " + trancheConfig);
    // console.log("programVyperCoreLending.rpc.deposit account: " + solendInit.reserveToken);
    // console.log("programVyperCoreLending.rpc.deposit account: " + userReserveTokenAccount);
    // console.log("programVyperCoreLending.rpc.deposit account: " + solendInit.ownerReserveTokenAccount);
    // console.log("programVyperCoreLending.rpc.deposit account: " + vaultAuthority);
    // console.log("programVyperCoreLending.rpc.deposit account: " + userCollateralTokenAccount);
    // console.log("programVyperCoreLending.rpc.deposit account: " + solendInit.reserve.reserve.config.collateralMintAddress);
    // console.log(
    //   "programVyperCoreLending.rpc.deposit account: " + new anchor.web3.PublicKey(solendInit.reserve.reserve.config.address)
    // );
    // console.log("programVyperCoreLending.rpc.deposit account: " + solendInit.marketKeypair.publicKey);
    // console.log("programVyperCoreLending.rpc.deposit account: " + solendInit.owner.publicKey);
    // console.log("programVyperCoreLending.rpc.deposit account: " + seniorTrancheMint);
    // console.log("programVyperCoreLending.rpc.deposit account: " + seniorTrancheVault);
    // console.log("programVyperCoreLending.rpc.deposit account: " + juniorTrancheMint);
    // console.log("programVyperCoreLending.rpc.deposit account: " + juniorTrancheVault);
    // console.log("programVyperCoreLending.rpc.deposit account: " + programProxyLendingSolend.programId);
    // console.log("programVyperCoreLending.rpc.deposit account: " + DEVNET_SOLEND_PROGRAM_ID);
    // console.log("programVyperCoreLending.rpc.deposit account: " + anchor.web3.SystemProgram.programId);
    // console.log("programVyperCoreLending.rpc.deposit account: " + TOKEN_PROGRAM_ID);
    // console.log("programVyperCoreLending.rpc.deposit account: " + ASSOCIATED_TOKEN_PROGRAM_ID);
    // console.log("programVyperCoreLending.rpc.deposit account: " + anchor.web3.SYSVAR_RENT_PUBKEY);
    // console.log("programVyperCoreLending.rpc.deposit account: " + anchor.web3.SYSVAR_CLOCK_PUBKEY);

    const tx2 = await programVyperCoreLending.rpc.deposit(
      vaultAuthorityBump,
      bn(quantityToDeposit), // quantity
      [bn(seniorTrancheMintQuantity), bn(juniorTrancheMintQuantity)], // mint_count
      {
        accounts: {
          authority: programVyperCoreLending.provider.wallet.publicKey,
          trancheConfig,
          mint: solendInit.reserveToken,
          depositSourceAccount: userReserveTokenAccount,

          protocolVault: solendInit.ownerReserveTokenAccount, // SOLEND RESERVE https://docs.solend.fi/developers/addresses/devnet#reserves
          vaultAuthority: vaultAuthority, // vyper-core PDA

          collateralTokenAccount: userCollateralTokenAccount, // Token account for receiving collateral token (as proof of deposit)
          collateralMint: solendInit.reserve.reserve.config.collateralMintAddress, // SPL token mint for collateral token
          protocolState: new anchor.web3.PublicKey(solendInit.reserve.reserve.config.address), // State account for protocol (reserve-state-account)
          lendingMarketAccount: solendInit.marketKeypair.publicKey, // Lending market account (https://docs.solend.fi/developers/addresses/devnet#devnet)
          lendingMarketAuthority: solendInit.owner.publicKey, // Lending market authority (PDA)

          seniorTrancheMint,
          seniorTrancheVault,

          juniorTrancheMint,
          juniorTrancheVault,

          proxyProtocolProgram: programProxyLendingSolend.programId,
          protocolProgram: DEVNET_SOLEND_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        },
      }
    );
    console.log("tx: " + tx2);

    const account = await programVyperCoreLending.account.trancheConfig.fetch(trancheConfig);

    console.log("account: " + JSON.stringify(account));
    console.log("depositedQuantity: " + account.depositedQuantiy.map((c) => c.toNumber()));
    assert.equal(
      account.depositedQuantiy
        .map((c) => c.toNumber())
        .reduce((a: number, b: number): number => {
          return a + b;
        }, 0),
      quantityToDeposit
    );
    assert.deepEqual(account.interestSplit, inputData.interestSplit);
    assert.deepEqual(account.capitalSplit, inputData.capitalSplit);

    const seniorTrancheMintInfo = await getMintInfo(programVyperCoreLending.provider, seniorTrancheMint);
    assert.equal(seniorTrancheMintInfo.decimals, 0);
    assert.equal(seniorTrancheMintInfo.supply.toNumber(), seniorTrancheMintQuantity);

    const seniorTrancheVaultInto = await getTokenAccount(programVyperCoreLending.provider, seniorTrancheVault);
    assert.equal(seniorTrancheVaultInto.amount, seniorTrancheMintQuantity);

    const juniorTrancheMintInfo = await getMintInfo(programVyperCoreLending.provider, juniorTrancheMint);
    assert.equal(juniorTrancheMintInfo.decimals, 0);
    assert.equal(juniorTrancheMintInfo.supply.toNumber(), juniorTrancheMintQuantity);

    const juniorTrancheVaultInto = await getTokenAccount(programVyperCoreLending.provider, juniorTrancheVault);
    assert.equal(juniorTrancheVaultInto.amount, juniorTrancheMintQuantity);
  });

  interface InitLendingMarketResult {
    reserve: SolendReserveAsset;
    marketKeypair: anchor.web3.Keypair;
    owner: anchor.web3.Keypair;
    reserveToken: anchor.web3.PublicKey;
    ownerReserveTokenAccount: anchor.web3.PublicKey;
  }

  async function initLendingMarkets(): Promise<InitLendingMarketResult> {
    // console.log("init lending markets (castle-finance)");

    // const sig = await programVyperCoreLending.provider.connection.requestAirdrop(solendOwner.publicKey, 1000000000);
    // const supplSig = await programVyperCoreLending.provider.connection.requestAirdrop(referralFeeOwner, 1000000000);
    // await programVyperCoreLending.provider.connection.confirmTransaction(sig, "singleGossip");
    // await programVyperCoreLending.provider.connection.confirmTransaction(supplSig, "singleGossip");

    const initialReserveAmount = 100;
    const solendOwner = anchor.web3.Keypair.generate();
    const [reserveToken, ownerReserveTokenAccount] = await createMintAndVault(
      programVyperCoreLending.provider,
      bn(3 * initialReserveAmount),
      solendOwner.publicKey,
      2
    );

    const pythProduct = new anchor.web3.PublicKey("ALP8SdU9oARYVLgLR7LrqMNCYBnhtnQz1cj6bwgwQmgj");
    const pythPrice = new anchor.web3.PublicKey("H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG");
    const switchboardFeed = new anchor.web3.PublicKey("AdtRGGhmqvom3Jemp5YNrxd9q9unX36BZk1pujkkXijL");

    const pythProgram = new anchor.web3.PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH");
    const switchboardProgram = new anchor.web3.PublicKey("DtmE9D2CSB4L5D6A15mraeEjrGMm6auWVzgaD8hK2tZM");

    // console.log("init lending markets:");
    // console.log("pyth product: " + pythProduct);
    // console.log("pyth price: " + pythPrice);
    // console.log("switchboard feed: " + switchboardFeed);
    // console.log("pyth program: " + pythProgram);
    // console.log("switchboard program: " + switchboardProgram);

    const [solendReserve, marketKeypair] = await SolendReserveAsset.initialize(
      programVyperCoreLending.provider,
      solendOwner,
      //@ts-ignore
      programVyperCoreLending.provider.wallet,
      reserveToken,
      pythProgram,
      switchboardProgram,
      pythProduct,
      pythPrice,
      switchboardFeed,
      ownerReserveTokenAccount,
      initialReserveAmount
    );

    return {
      owner: solendOwner,
      marketKeypair,
      ownerReserveTokenAccount,
      reserveToken,
      reserve: solendReserve,
    };
  }
});