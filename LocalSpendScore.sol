// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LocalSpendScore
/// @notice Stores a customer's local-spend score. It never stores what was
///         bought, where, or for how much. The receipt is read by a model on
///         the customer's own device and then discarded; only the resulting
///         score reaches this contract, together with `sigRef`, a hash of the
///         merchant signature that proves a real purchase backed the update.
contract LocalSpendScore {
    struct Record {
        uint8 score;      // 0-100, share of spend at independent businesses
        uint32 visits;    // how many signed receipts fed this score
        bytes32 sigRef;   // keccak256 of the most recent merchant signature
        uint64 updatedAt;
    }

    mapping(address => Record) private records;

    event ScoreSubmitted(
        address indexed customer,
        uint8 score,
        uint32 visits,
        bytes32 sigRef,
        uint64 timestamp
    );

    error ScoreOutOfRange(uint8 score);
    error MissingSignatureRef();

    /// @notice Publish your own score. msg.sender is the customer, so nobody
    ///         can write a score on someone else's behalf.
    function submitScore(uint8 score, uint32 visits, bytes32 sigRef) external {
        if (score > 100) revert ScoreOutOfRange(score);
        if (sigRef == bytes32(0)) revert MissingSignatureRef();

        records[msg.sender] = Record({
            score: score,
            visits: visits,
            sigRef: sigRef,
            updatedAt: uint64(block.timestamp)
        });

        emit ScoreSubmitted(msg.sender, score, visits, sigRef, uint64(block.timestamp));
    }

    /// @notice Read a customer's published score. A shop can call this to
    ///         decide whether to offer returning-client pricing.
    function scoreOf(address customer)
        external
        view
        returns (uint8 score, uint32 visits, bytes32 sigRef, uint64 updatedAt)
    {
        Record memory r = records[customer];
        return (r.score, r.visits, r.sigRef, r.updatedAt);
    }
}
