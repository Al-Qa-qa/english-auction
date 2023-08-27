import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { EnglishAuction, NftItem } from "../typechain-types";
import { DURATION, STARTING_PRICE, TOKEN_ID } from "../helper-hardhat-config";

import { BigNumber } from "ethers";

// ---

async function bid() {
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

  const highestBid: BigNumber = (await englishAuction.getAuction(nftItem.address, TOKEN_ID))
    .highestBid;

  // We will bid with the amount + 0.01 ETH every time we fire the function

  try {
    // Creating auction of the item
    await englishAuction
      .connect(bidder)
      .bid(nftItem.address, TOKEN_ID, { value: highestBid.add(STARTING_PRICE) });

    console.log("New Bidder");

    const auction = await englishAuction.getAuction(nftItem.address, TOKEN_ID);

    auction.bidders.forEach((bidder, i) => {
      console.log(
        `Bidder: ${bidder.bidder} - value: ${ethers.utils.formatEther(bidder.value)} ETH`
      );
    });

    console.log(`Highest Bidder: ${auction.highestBidder}`);
    console.log(`Highest Bid: ${ethers.utils.formatEther(auction.highestBid)} ETH`);
  } catch (err) {
    console.log(err);
    throw new Error("Failed to buy item");
  }

  return englishAuction;
}

bid()
  .then((englishAuction) => {
    console.log("Bidded Successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
