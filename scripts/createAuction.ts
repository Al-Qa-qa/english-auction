import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { EnglishAuction, NftItem } from "../typechain-types";
import { DURATION, STARTING_PRICE, TOKEN_ID } from "../helper-hardhat-config";

async function createAuction() {
  const [seller, buyer] = await ethers.getSigners();
  const networkName: string = network.name;
  const contracts = Object(jsonContracts);
  if (!contracts[networkName].EnglishAuction) {
    throw new Error("Contract is not deployed yet");
  }
  if (networkName === "hardhat") {
    throw new Error("Can't run scripts to hardhat network deployed contract");
  }
  const englishAuction: EnglishAuction = await ethers.getContractAt(
    "EnglishAuction",
    contracts[networkName].EnglishAuction,
    seller
  );

  const nftItem: NftItem = await ethers.getContractAt(
    "NftItem",
    contracts[networkName].NftItem,
    seller
  );

  try {
    // Approving item
    await nftItem.connect(seller).setApprovalForAll(englishAuction.address, true);
  } catch (err) {
    console.log("Failed to approve the market");
    console.log(err);
  }

  try {
    // Creating auction of the item
    await englishAuction
      .connect(seller)
      .createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DURATION);
  } catch (err) {
    console.log(err);
    throw new Error("Failed to list item in the Auction");
  }

  return englishAuction;
}

createAuction()
  .then((englishAuction) => {
    console.log("Item listed on the auction successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
