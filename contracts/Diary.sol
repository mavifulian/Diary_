pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract DiaryZama is ZamaEthereumConfig {
    struct DiaryEntry {
        string encryptedText;          
        euint32 encryptedMood;        
        uint256 timestamp;            
        address author;               
        uint32 decryptedMood;         
        bool isVerified;              
    }

    mapping(uint256 => DiaryEntry) public diaryEntries;
    mapping(address => uint256[]) public userEntries;
    mapping(uint256 => bool) public entryExists;

    uint256 public entryCount = 0;
    uint256 public constant MAX_DIARY_ENTRIES = 100;

    event EntryCreated(uint256 indexed entryId, address indexed author);
    event MoodDecrypted(uint256 indexed entryId, uint32 decryptedMood);

    constructor() ZamaEthereumConfig() {
    }

    function createEntry(
        string calldata encryptedText,
        externalEuint32 encryptedMood,
        bytes calldata moodProof
    ) external {
        require(entryCount < MAX_DIARY_ENTRIES, "Maximum entries reached");
        require(FHE.isInitialized(FHE.fromExternal(encryptedMood, moodProof)), "Invalid encrypted mood");

        uint256 entryId = entryCount;
        entryCount++;

        diaryEntries[entryId] = DiaryEntry({
            encryptedText: encryptedText,
            encryptedMood: FHE.fromExternal(encryptedMood, moodProof),
            timestamp: block.timestamp,
            author: msg.sender,
            decryptedMood: 0,
            isVerified: false
        });

        FHE.allowThis(diaryEntries[entryId].encryptedMood);
        FHE.makePubliclyDecryptable(diaryEntries[entryId].encryptedMood);

        userEntries[msg.sender].push(entryId);
        entryExists[entryId] = true;

        emit EntryCreated(entryId, msg.sender);
    }

    function verifyMoodDecryption(
        uint256 entryId,
        bytes memory abiEncodedClearMood,
        bytes memory decryptionProof
    ) external {
        require(entryExists[entryId], "Entry does not exist");
        require(!diaryEntries[entryId].isVerified, "Mood already verified");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(diaryEntries[entryId].encryptedMood);

        FHE.checkSignatures(cts, abiEncodedClearMood, decryptionProof);

        uint32 decodedMood = abi.decode(abiEncodedClearMood, (uint32));
        require(decodedMood >= 1 && decodedMood <= 5, "Invalid mood value");

        diaryEntries[entryId].decryptedMood = decodedMood;
        diaryEntries[entryId].isVerified = true;

        emit MoodDecrypted(entryId, decodedMood);
    }

    function getEncryptedMood(uint256 entryId) external view returns (euint32) {
        require(entryExists[entryId], "Entry does not exist");
        return diaryEntries[entryId].encryptedMood;
    }

    function getEntry(uint256 entryId) external view returns (
        string memory encryptedText,
        uint256 timestamp,
        address author,
        bool isVerified,
        uint32 decryptedMood
    ) {
        require(entryExists[entryId], "Entry does not exist");
        DiaryEntry storage entry = diaryEntries[entryId];

        return (
            entry.encryptedText,
            entry.timestamp,
            entry.author,
            entry.isVerified,
            entry.decryptedMood
        );
    }

    function getUserEntries(address user) external view returns (uint256[] memory) {
        return userEntries[user];
    }

    function getTotalEntries() external view returns (uint256) {
        return entryCount;
    }

    function searchEntriesByMood(uint32 mood) external view returns (uint256[] memory) {
        uint256[] memory results = new uint256[](entryCount);
        uint256 count = 0;

        for (uint256 i = 0; i < entryCount; i++) {
            if (diaryEntries[i].isVerified && diaryEntries[i].decryptedMood == mood) {
                results[count] = i;
                count++;
            }
        }

        assembly {
            mstore(results, count)
        }

        return results;
    }

    function isAvailable() public pure returns (bool) {
        return true;
    }
}

