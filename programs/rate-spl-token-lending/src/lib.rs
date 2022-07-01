// Provide fair value for a particular Solend pool (mono-asset)

// Step 1. Read Solend data
// Step 2. Determine fair value of tokens
// Step 3. Implement rate state plugin (RateState)

// TODO: Fix `Reserve` struct import, add additional imports
// https://github.com/solana-labs/solana-program-library/blob/master/token-lending/program/src/state/reserve.rs
use anchor_lang::prelude::*;
use anchor_lang::solana_program::token_lending::state::Reserve; // ?
use spl_token_lending::state::Reserve; // ?
use crate::refresh_tranche_fair_value::{RateState, RefreshTrancheFairValue}; // ?


// TODO: Read data from Solend (or other SPL-based lending platforms)
// Initialize vault data from Solend
// Borrowed from castle-vault/src/state.rs
#[account]
pub struct Vault {
    /// Program version when initialized: [major, minor, patch]
    pub version: [u8; 3],

    /// Account that is allowed to call the subsequent instructions
    pub owner: Pubkey,

    // TODO: add other fields as necessary?
}

// TODO: Determine fair value of tokens
// First, deserialize the data
// Borrowed from castle-vault/adapters/solend.rs
// TODO: Fix Reserve struct import
#[derive(Clone)]
pub struct SolendReserve(Reserve);

impl anchor_lang::AccountDeserialize for SolendReserve {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self, ProgramError> {
        SolendReserve::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self, ProgramError> {
        <Reserve as solana_program::program_pack::Pack>::unpack(buf).map(SolendReserve)
    }
}

// TODO: Collect prices from deserialized token values

// TODO: Implement RateState plugin
