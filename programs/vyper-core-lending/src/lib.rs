pub mod adapters;
pub mod error;
pub mod inputs;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use inputs::CreateTrancheConfigInput;
use instructions::*;

declare_id!("CJt5bFSebqNErzCdLNvk678S8Bmwdx2dCR8vrBS1eBoU");

#[program]
pub mod vyper_core_lending {

    use super::*;

    pub fn create_tranche(
        ctx: Context<CreateTranchesContext>,
        input_data: CreateTrancheConfigInput,
        tranche_config_id: u64,
        tranche_config_bump: u8,
        senior_tranche_mint_bump: u8,
        junior_tranche_mint_bump: u8,
    ) -> ProgramResult {
        instructions::create_tranche::handler(
            ctx,
            input_data,
            tranche_config_id,
            tranche_config_bump,
            senior_tranche_mint_bump,
            junior_tranche_mint_bump,
        )
    }

    pub fn update_interest_split(
        ctx: Context<UpdateTrancheConfigContext>,
        interest_split: [u32; 2],
    ) -> ProgramResult {
        instructions::update_tranche_config::handler_update_interest_split(ctx, interest_split)
    }

    pub fn update_capital_split(
        ctx: Context<UpdateTrancheConfigContext>,
        capital_split: [u32; 2],
    ) -> ProgramResult {
        instructions::update_tranche_config::handler_update_capital_split(ctx, capital_split)
    }

    pub fn update_deposited_quantity(
        ctx: Context<UpdateDepositedQuantityContext>,
    ) -> ProgramResult {
        instructions::update_deposited_quantity::handler(ctx)
    }

    pub fn create_serum_market(
        ctx: Context<CreateSerumMarketContext>,
        vault_signer_nonce: u8,
    ) -> ProgramResult {
        instructions::create_serum_market::handler(ctx, vault_signer_nonce)
    }

    pub fn deposit(
        ctx: Context<DepositContext>,
        quantity: u64,
        mint_count: [u64; 2],
    ) -> ProgramResult {
        instructions::deposit::handler(ctx, quantity, mint_count)
    }

    pub fn redeem(ctx: Context<RedeemContext>, redeem_quantity: [u64; 2]) -> ProgramResult {
        instructions::redeem::handler(ctx, redeem_quantity)
    }
}
