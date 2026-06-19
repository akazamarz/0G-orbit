// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOrbitAttestation {
    event Attestation(
        address indexed user,
        bytes32 indexed contentHash,
        uint256 timestamp,
        string storageRoot
    );

    function attestWithSignature(
        bytes32 contentHash,
        string calldata storageRoot,
        uint256 deadline,
        bytes calldata signature
    ) external;

    function isAttested(bytes32 contentHash) external view returns (bool);

    function getAttestation(bytes32 contentHash)
        external
        view
        returns (address user, uint256 timestamp, string memory storageRoot);

    function getDomainSeparator() external view returns (bytes32);
}

contract OrbitAttestation is IOrbitAttestation {
    struct Record {
        address user;
        uint256 timestamp;
        string storageRoot;
        bool exists;
    }

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 private constant ATTESTATION_TYPEHASH =
        keccak256("AttestationRequest(bytes32 contentHash,string storageRoot,uint256 deadline)");

    bytes32 private immutable _nameHash;
    bytes32 private immutable _versionHash;

    mapping(bytes32 => Record) private _records;

    constructor() {
        _nameHash = keccak256(bytes("Orbit"));
        _versionHash = keccak256(bytes("1"));
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                _nameHash,
                _versionHash,
                block.chainid,
                address(this)
            )
        );
    }

    function attestWithSignature(
        bytes32 contentHash,
        string calldata storageRoot,
        uint256 deadline,
        bytes calldata signature
    ) external override {
        require(block.timestamp <= deadline, "OrbitAttestation: expired");
        require(!_records[contentHash].exists, "OrbitAttestation: already attested");
        require(signature.length == 65, "OrbitAttestation: invalid signature length");

        bytes32 structHash = keccak256(
            abi.encode(ATTESTATION_TYPEHASH, contentHash, storageRoot, deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;

        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "OrbitAttestation: invalid signature");

        _records[contentHash] = Record({
            user: signer,
            timestamp: block.timestamp,
            storageRoot: storageRoot,
            exists: true
        });
        emit Attestation(signer, contentHash, block.timestamp, storageRoot);
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

    function getDomainSeparator() external view override returns (bytes32) {
        return _domainSeparator();
    }
}
