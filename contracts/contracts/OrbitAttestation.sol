// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOrbitAttestation {
    event Attestation(
        address indexed user,
        bytes32 indexed contentHash,
        uint256 timestamp,
        string storageRoot
    );

    function attest(bytes32 contentHash, string calldata storageRoot) external;
    function isAttested(bytes32 contentHash) external view returns (bool);
    function getAttestation(bytes32 contentHash)
        external
        view
        returns (address user, uint256 timestamp, string memory storageRoot);
}

contract OrbitAttestation is IOrbitAttestation {
    struct Record {
        address user;
        uint256 timestamp;
        string storageRoot;
        bool exists;
    }

    mapping(bytes32 => Record) private _records;

    function attest(bytes32 contentHash, string calldata storageRoot) external override {
        require(!_records[contentHash].exists, "OrbitAttestation: already attested");
        _records[contentHash] = Record({
            user: msg.sender,
            timestamp: block.timestamp,
            storageRoot: storageRoot,
            exists: true
        });
        emit Attestation(msg.sender, contentHash, block.timestamp, storageRoot);
    }

    function isAttested(bytes32 contentHash) external view override returns (bool) {
        return _records[contentHash].exists;
    }

    function getAttestation(bytes32 contentHash)
        external
        view
        override
        returns (address user, uint256 timestamp, string memory storageRoot)
    {
        Record memory r = _records[contentHash];
        require(r.exists, "OrbitAttestation: no record");
        return (r.user, r.timestamp, r.storageRoot);
    }
}
