import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { EnglishAuction, NftItem } from "../typechain-types";
import { DURATION, STARTING_PRICE, TOKEN_ID } from "../helper-hardhat-config";
import increaseTime from "../utils/increase-time";

import { BigNumber } from "ethers";

async function endAuction() {
  const [seller, bidder] = await ethers.getSigners();
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

  // 7 days + 1 second to pass the endingAt time
  await increaseTime(DURATION + 1);

  try {
    const sellerBalanceBefore: BigNumber = await ethers.provider.getBalance(seller.address);
    const nftOwnerBefore: string = await nftItem.ownerOf(TOKEN_ID);

    console.log(`Seller balance before: ${sellerBalanceBefore}`);
    console.log(`NFT owner before: ${nftOwnerBefore}`);

    // Creating auction of the item
    await englishAuction.connect(seller).endAuction(nftItem.address, TOKEN_ID);

    const sellerBalanceAfter: BigNumber = await ethers.provider.getBalance(seller.address);
    const nftOwnerAfter: string = await nftItem.ownerOf(TOKEN_ID);

    console.log(`Seller balance after: ${sellerBalanceAfter}`);
    console.log(`NFT owner after: ${nftOwnerAfter}`);
  } catch (err) {
    console.log(err);
    throw new Error("Failed to end the auction");
  }

  return englishAuction;
}

endAuction()
  .then((englishAuction) => {
    console.log("Auction ended successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
