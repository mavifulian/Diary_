# Private Personal Diary

Private Personal Diary is a privacy-preserving application that allows users to securely store and manage their diary entries using Zama's Fully Homomorphic Encryption (FHE) technology. This application ensures that your thoughts and memories remain confidential, leveraging advanced cryptographic methods to prevent unauthorized access while enabling powerful search capabilities.

## The Problem

In the digital age, personal data privacy is at risk. Traditional diary applications often store user entries in cleartext, exposing intimate thoughts and experiences to potential breaches. Unauthorized access to this sensitive information can lead to identity theft, personal embarrassment, or even manipulation. The inherent danger of cleartext data lies in its vulnerability; once exposed, the content can be misused or permanently lost, undermining the sanctity of one's personal reflections.

## The Zama FHE Solution

Fully Homomorphic Encryption revolutionizes data security by enabling computation on encrypted data, thus ensuring that personal information remains confidential throughout its lifecycle. Using Zama's fhevm library, users can write diary entries that are automatically encrypted before storage. This empowers users to retrieve and manipulate their data—such as searching for specific memories—without ever exposing it in its original form. The cryptographic algorithms underpinning Zama's technology allow for complex operations on encrypted data, making it possible to perform homomorphic searches directly within the encrypted structure.

## Key Features

- 🔒 **Data Encryption**: Entries are encrypted at the point of creation, ensuring maximum security.
- 🔍 **Homomorphic Search**: Retrieve specific entries without decrypting the entire dataset, preserving privacy.
- 🗂️ **Decentralized Storage**: Your diary entries are securely stored in a decentralized manner, minimizing reliance on a central authority.
- 📝 **User-Friendly Interface**: Write and organize your entries with an intuitive writing interface integrated with a calendar.
- 📅 **Long-Term Privacy**: Durable storage guarantees that your memories are safe and unaltered over time.

## Technical Architecture & Stack

The Private Personal Diary application utilizes the following technology stack:

- **Frontend**: React.js for a dynamic user interface.
- **Backend**: Node.js with Express for handling requests and managing application logic.
- **Database**: A decentralized storage solution for diary entries ensuring durability and privacy.
- **Core Privacy Engine**: Zama’s FHE libraries, specifically:
  - **fhevm**: For processing encrypted inputs and supporting homomorphic computations.
  
This combination of technologies facilitates a seamless experience while providing robust security measures.

## Smart Contract / Core Logic

Here is a simplified example of how diary entries can be encrypted and searched:

```solidity
pragma solidity ^0.8.0;

contract Diary {
    struct Entry {
        uint64 id;
        bytes encryptedContent;
    }

    mapping(uint64 => Entry) private entries;
    uint64 private entryCount = 0;

    function addEntry(bytes memory _encryptedContent) public {
        entryCount++;
        entries[entryCount] = Entry(entryCount, _encryptedContent);
    }

    function searchEntry(uint64 id) public view returns (bytes memory) {
        return entries[id].encryptedContent;  // Returns encrypted content
    }
}
```

In this example, diary entries are stored in encrypted form, ensuring privacy and integrity.

## Directory Structure

```
PrivatePersonalDiary/
├── contracts/
│   └── Diary.sol               # Smart contract for managing diary entries
├── src/
│   ├── components/              # React components for UI
│   ├── App.js                   # Main application file
│   └── index.js                 # Entry point
├── scripts/
│   └── deploy.js                # Scripts for deploying the smart contract
├── package.json                 # Project dependencies and scripts
└── README.md                    # Project documentation
```

## Installation & Setup

To get started with the Private Personal Diary application, please follow these steps:

### Prerequisites

- [Node.js](https://nodejs.org/) (version 14 or higher)
- [Solidity](https://docs.soliditylang.org) compiler for smart contracts
- Access to a decentralized storage solution

### Dependencies

1. Install necessary dependencies using npm:

   ```bash
   npm install
   ```

2. Install Zama's FHE library:

   ```bash
   npm install fhevm
   ```

## Build & Run

To compile the smart contracts and run the application, execute the following commands:

1. Compile the smart contracts:

   ```bash
   npx hardhat compile
   ```

2. Start the development server:

   ```bash
   npm start
   ```

This will launch the application, and you can interact with your diary through the user interface.

## Acknowledgements

A heartfelt thank you to Zama for providing the open-source FHE primitives that enable the Private Personal Diary project. Their cutting-edge technology empowers developers to create secure applications that prioritize user privacy without sacrificing functionality.

---

With Private Personal Diary, you can confidently document your life’s moments, knowing that your personal reflections are protected by advanced encryption techniques. Join the movement towards safer digital experiences powered by Zama’s Fully Homomorphic Encryption technology.