import { expect, assert } from "chai";
import { ethers, network } from "hardhat";
import {
  EnglishAuction,
  EnglishAuction__factory,
  NftItem,
  NftItem__factory,
} from "../../typechain-types";

// Function
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// Data
import {
  ADDRESS_ZERO,
  DURATION,
  NFT_ITEM_NAME,
  NFT_ITEM_SYMBOL,
  STARTING_PRICE,
  TOKEN_ID,
  developmentChains,
} from "../../helper-hardhat-config";

// Types
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractTransaction, ContractReceipt } from "ethers/src.ts/ethers";
import { BigNumber } from "ethers";

// ------------

describe("EnglishAuction", function () {
  const REQUIRED: BigNumber = ethers.utils.parseUnits("2");
  beforeEach(async () => {
    if (!developmentChains.includes(network.name)) {
      throw new Error("You need to be on a development chain to run unit tests");
    }
  });

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  type DeployFixture = {
    deployer: SignerWithAddress;
    englishAuction: EnglishAuction;
    nftItem: NftItem;
  };
  async function deployEnglishAuctionFixture(): Promise<DeployFixture> {
    const [deployer]: SignerWithAddress[] = await ethers.getSigners();

    const nftItemFactory: NftItem__factory = await ethers.getContractFactory("NftItem", deployer);
    const nftItem: NftItem = await nftItemFactory.deploy(NFT_ITEM_NAME, NFT_ITEM_SYMBOL);
    await nftItem.deployed();

    const englishAuctionFactory: EnglishAuction__factory = await ethers.getContractFactory(
      "EnglishAuction",
      deployer
    );
    const englishAuction: EnglishAuction = await englishAuctionFactory.deploy();
    await englishAuction.deployed();

    // Approve item by our EnglishAuction contract
    await nftItem.setApprovalForAll(englishAuction.address, true);
    return { deployer, englishAuction, nftItem };
  }

  async function listItemInAuction(englishAuction: EnglishAuction, nftAddress: string) {
    await englishAuction.createAuction(nftAddress, TOKEN_ID, STARTING_PRICE, DURATION);
    return englishAuction;
  }

  async function bidInAuction(
    englishAuction: EnglishAuction,
    nftAddress: string,
    bidder: SignerWithAddress
  ) {
    await englishAuction.connect(bidder).bid(nftAddress, TOKEN_ID, { value: STARTING_PRICE });
    return englishAuction;
  }

  describe("#createAuction", function () {
    it("should set auction parameters correctly", async function () {
      const { deployer, englishAuction, nftItem } = await loadFixture(deployEnglishAuctionFixture);

      const tx: ContractTransaction = await englishAuction.createAuction(
        nftItem.address,
        TOKEN_ID,
        STARTING_PRICE,
        DURATION
      );

      const txReceipt: ContractReceipt = await tx.wait();

      // Getting the block timestamp to compare it with startAt parameter
      const blockTime: number = (await ethers.provider.getBlock(txReceipt.blockNumber)).timestamp;

      const auction = await englishAuction.getAuction(nftItem.address, TOKEN_ID);

      // You should avoid testing it this was, there should be only on assert or expect in one `it`
      assert.equal(auction.seller, deployer.address);
      assert.equal(auction.nftAddress, nftItem.address);
      assert(auction.tokenId.eq(TOKEN_ID));
      assert(auction.startingAt.eq(BigNumber.from(blockTime)));
      assert(auction.endingAt.eq(BigNumber.from(blockTime).add(DURATION)));
      assert(auction.startingPrice.eq(STARTING_PRICE));
      assert(auction.highestBid.eq(0));
      assert.equal(auction.highestBidder, ADDRESS_ZERO);
      // Checking bidders array initialized correctly
      assert.equal(auction.bidders.length, 1);
      assert.equal(auction.bidders[0].bidder, ADDRESS_ZERO);
      assert(auction.bidders[0].value.eq(0));
      // ---
      assert.equal(auction.status, 1 /* IN_PROGRESS */);
    });

    it("should emit `AuctionCreated` event if auction created successfully", async function () {
      const { deployer, englishAuction, nftItem } = await loadFixture(deployEnglishAuctionFixture);

      await expect(
        englishAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DURATION)
      )
        .to.emit(englishAuction, "AuctionCreated")
        .withArgs(nftItem.address, TOKEN_ID);
    });

    it("should allow even if the auction is `ENDED`", async function () {
      const {
        deployer,
        englishAuction: _englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      const englishAuction = await listItemInAuction(_englishAuction, nftItem.address);

      await ethers.provider.send("evm_increaseTime", [
        DURATION + 1 /* increase time by 7 days and 1 second to pass endingAt parameter */,
      ]);
      await ethers.provider.send("evm_mine", []);

      await englishAuction.endAuction(nftItem.address, TOKEN_ID);

      // Creating auction again
      await expect(
        englishAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DURATION)
      )
        .to.emit(englishAuction, "AuctionCreated")
        .withArgs(nftItem.address, TOKEN_ID);
    });

    it("reverts if NFT address is zero address", async function () {
      const { deployer, englishAuction, nftItem } = await loadFixture(deployEnglishAuctionFixture);

      await expect(
        englishAuction.createAuction(ADDRESS_ZERO, TOKEN_ID, STARTING_PRICE, DURATION)
      ).to.be.revertedWithCustomError(englishAuction, "EnglishAuction__InvalidAddress");
    });

    it("reverts if the connector is not the owner of the NFT", async function () {
      const [, hacker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, englishAuction, nftItem } = await loadFixture(deployEnglishAuctionFixture);

      await expect(
        englishAuction
          .connect(hacker)
          .createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DURATION)
      )
        .to.be.revertedWithCustomError(englishAuction, "EnglishAuction__NotOwner")
        .withArgs(nftItem.address, TOKEN_ID, hacker.address);
    });

    it("reverts if the item is not approved by EnglishAuction contract", async function () {
      const { deployer, englishAuction, nftItem } = await loadFixture(deployEnglishAuctionFixture);

      // remove approval from EnglishAuction contract
      await nftItem.setApprovalForAll(englishAuction.address, false);

      await expect(
        englishAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DURATION)
      )
        .to.be.revertedWithCustomError(englishAuction, "EnglishAuction__NotApproved")
        .withArgs(nftItem.address, TOKEN_ID, deployer.address);
    });

    it("reverts if the auction is already created", async function () {
      const { deployer, englishAuction, nftItem } = await loadFixture(deployEnglishAuctionFixture);

      // Create the auction
      await englishAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DURATION);

      // Trying to create the auction again
      await expect(
        englishAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DURATION)
      )
        .to.be.revertedWithCustomError(englishAuction, "EnglishAuction__AuctionCreated")
        .withArgs(nftItem.address, TOKEN_ID);
    });
  });

  describe("#bid", function () {
    it("should emit `NewBid` event on successful bidding", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: _englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const englishAuction = await listItemInAuction(_englishAuction, nftItem.address);

      await expect(
        englishAuction.connect(bidder).bid(nftItem.address, TOKEN_ID, { value: STARTING_PRICE })
      )
        .to.emit(englishAuction, "NewBid")
        .withArgs(nftItem.address, TOKEN_ID, STARTING_PRICE);
    });

    it("should update auction parameters on successful bidding", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: _englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const englishAuction = await listItemInAuction(_englishAuction, nftItem.address);

      await englishAuction
        .connect(bidder)
        .bid(nftItem.address, TOKEN_ID, { value: STARTING_PRICE });

      const auction = await englishAuction.getAuction(nftItem.address, TOKEN_ID);

      assert.equal(auction.highestBidder, bidder.address);
      assert(auction.highestBid.eq(STARTING_PRICE));
      // Check bidders array
      assert.equal(auction.bidders.length, 2);
      assert.equal(auction.bidders[1].bidder, bidder.address);
      assert(auction.bidders[1].value.eq(STARTING_PRICE));
    });

    it("should refund the previous bidder if there is another bidder bidded", async function () {
      const [, bidder1, bidder2]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: _englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const englishAuction: EnglishAuction = await listItemInAuction(
        _englishAuction,
        nftItem.address
      );
      const bidder1BidAmount: BigNumber = ethers.utils.parseEther("0.05"); // starting price is 0.01 ETH
      const bidder2BidAmount: BigNumber = ethers.utils.parseEther("0.1"); // starting price is 0.01 ETH

      await englishAuction
        .connect(bidder1)
        .bid(nftItem.address, TOKEN_ID, { value: bidder1BidAmount });

      const bidder1BalanceBeforeRefunding: BigNumber = await ethers.provider.getBalance(
        bidder1.address
      );

      await englishAuction
        .connect(bidder2)
        .bid(nftItem.address, TOKEN_ID, { value: bidder2BidAmount });

      const bidder1BalanceAfterRefunding: BigNumber = await ethers.provider.getBalance(
        bidder1.address
      );

      assert(bidder1BalanceAfterRefunding.eq(bidder1BalanceBeforeRefunding.add(bidder1BidAmount)));
    });

    it("reverts if the item is not listed for auction", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();
      const { englishAuction, nftItem } = await loadFixture(deployEnglishAuctionFixture);
      await expect(
        englishAuction.connect(bidder).bid(nftItem.address, TOKEN_ID, { value: STARTING_PRICE })
      )
        .to.be.revertedWithCustomError(englishAuction, "EnglishAuction__AuctionNotInProgress")
        .withArgs(nftItem.address, TOKEN_ID);
    });

    it("reverts if (bidAmount > startingPrice) in case of first bidder", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();

      const { englishAuction: _englishAuction, nftItem } = await loadFixture(
        deployEnglishAuctionFixture
      );

      // List item for auction
      const englishAuction: EnglishAuction = await listItemInAuction(
        _englishAuction,
        nftItem.address
      );
      const bidAmount: BigNumber = ethers.utils.parseEther("0.005"); // starting price is 0.01 ETH

      await expect(
        englishAuction.connect(bidder).bid(nftItem.address, TOKEN_ID, { value: bidAmount })
      )
        .to.be.revertedWithCustomError(englishAuction, "EnglishAuction__InsufficientAmount")
        .withArgs(nftItem.address, TOKEN_ID, bidAmount);
    });

    it("reverts if (bidAmount > higestBid) in case this is not the first bidder", async function () {
      const [, bidder1, bidder2]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: _englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const englishAuction: EnglishAuction = await listItemInAuction(
        _englishAuction,
        nftItem.address
      );
      const bidder1BidAmount: BigNumber = ethers.utils.parseEther("0.05"); // starting price is 0.01 ETH
      const bidder2BidAmount: BigNumber = ethers.utils.parseEther("0.03"); // starting price is 0.01 ETH

      await englishAuction
        .connect(bidder1)
        .bid(nftItem.address, TOKEN_ID, { value: bidder1BidAmount });

      await expect(
        englishAuction.connect(bidder2).bid(nftItem.address, TOKEN_ID, { value: bidder2BidAmount })
      )
        .to.be.revertedWithCustomError(englishAuction, "EnglishAuction__InsufficientAmount")
        .withArgs(nftItem.address, TOKEN_ID, bidder2BidAmount);
    });

    it("reverts if the seller is the bidder", async function () {
      const [bidder]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: _englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const englishAuction: EnglishAuction = await listItemInAuction(
        _englishAuction,
        nftItem.address
      );

      const seller: string = (await englishAuction.getAuction(nftItem.address, TOKEN_ID)).seller;

      await expect(
        englishAuction.connect(bidder).bid(nftItem.address, TOKEN_ID, { value: STARTING_PRICE })
      )
        .to.be.revertedWithCustomError(englishAuction, "EnglishAuction__SellerIsTheBidder")
        .withArgs(seller, bidder.address);
    });
  });

  describe("#endAuction", function () {
    it("should emit `AuctionEnded` event in successful ending", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: __englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const _englishAuction = await listItemInAuction(__englishAuction, nftItem.address);
      const englishAuction = await bidInAuction(_englishAuction, nftItem.address, bidder);

      await ethers.provider.send("evm_increaseTime", [
        DURATION + 1 /* increase time by 7 days and 1 second to pass endingAt parameter */,
      ]);
      await ethers.provider.send("evm_mine", []);

      await expect(englishAuction.connect(deployer).endAuction(nftItem.address, TOKEN_ID))
        .to.emit(englishAuction, "AuctionEnded")
        .withArgs(nftItem.address, TOKEN_ID, bidder.address);
    });

    it("should emit make auction state = `ENDED` in successful ending", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: __englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const _englishAuction = await listItemInAuction(__englishAuction, nftItem.address);
      const englishAuction = await bidInAuction(_englishAuction, nftItem.address, bidder);

      await ethers.provider.send("evm_increaseTime", [
        DURATION + 1 /* increase time by 7 days and 1 second to pass endingAt parameter */,
      ]);
      await ethers.provider.send("evm_mine", []);

      await englishAuction.connect(deployer).endAuction(nftItem.address, TOKEN_ID);

      const auction = await englishAuction.getAuction(nftItem.address, TOKEN_ID);

      assert.equal(auction.status, 2 /* ENDED */);
    });

    it("should reset bidders", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: __englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const _englishAuction = await listItemInAuction(__englishAuction, nftItem.address);
      const englishAuction = await bidInAuction(_englishAuction, nftItem.address, bidder);

      await ethers.provider.send("evm_increaseTime", [
        DURATION + 1 /* increase time by 7 days and 1 second to pass endingAt parameter */,
      ]);
      await ethers.provider.send("evm_mine", []);

      await englishAuction.connect(deployer).endAuction(nftItem.address, TOKEN_ID);

      const auction = await englishAuction.getAuction(nftItem.address, TOKEN_ID);

      assert.equal(auction.bidders.length, 1);
      assert.equal(auction.bidders[0].bidder, ADDRESS_ZERO);
      assert(auction.bidders[0].value.eq(0));
    });

    it("should transfer the NFT to the higheset bidder if existed", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: __englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const _englishAuction = await listItemInAuction(__englishAuction, nftItem.address);
      const englishAuction = await bidInAuction(_englishAuction, nftItem.address, bidder);

      await ethers.provider.send("evm_increaseTime", [
        DURATION + 1 /* increase time by 7 days and 1 second to pass endingAt parameter */,
      ]);
      await ethers.provider.send("evm_mine", []);

      await englishAuction.connect(deployer).endAuction(nftItem.address, TOKEN_ID);

      const newNftOwner: string = await nftItem.ownerOf(TOKEN_ID);

      assert.equal(newNftOwner, bidder.address);
    });

    it("should transfer the highestBid to the seller if existed", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: __englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const _englishAuction = await listItemInAuction(__englishAuction, nftItem.address);
      const englishAuction = await bidInAuction(_englishAuction, nftItem.address, bidder);

      await ethers.provider.send("evm_increaseTime", [
        DURATION + 1 /* increase time by 7 days and 1 second to pass endingAt parameter */,
      ]);
      await ethers.provider.send("evm_mine", []);

      const auction = await englishAuction.getAuction(nftItem.address, TOKEN_ID);

      const sellerBalanceBeforeEndingAuction: BigNumber = await ethers.provider.getBalance(
        auction.seller
      );

      await englishAuction.connect(deployer).endAuction(nftItem.address, TOKEN_ID);

      const sellerBalanceAfterEndingAuction: BigNumber = await ethers.provider.getBalance(
        auction.seller
      );

      expect(
        sellerBalanceAfterEndingAuction.eq(sellerBalanceBeforeEndingAuction.add(STARTING_PRICE))
      );
    });

    it("shouldn't change NFT ownership if the auction ended and there is no bidders", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: _englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const englishAuction = await listItemInAuction(_englishAuction, nftItem.address);

      await ethers.provider.send("evm_increaseTime", [
        DURATION + 1 /* increase time by 7 days and 1 second to pass endingAt parameter */,
      ]);
      await ethers.provider.send("evm_mine", []);

      await englishAuction.endAuction(nftItem.address, TOKEN_ID);

      const seller: string = (await englishAuction.getAuction(nftItem.address, TOKEN_ID)).seller;

      const nftOwner: string = await nftItem.ownerOf(TOKEN_ID);

      assert.equal(nftOwner, seller);
    });

    it("reverts if the auction is not in progress", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, englishAuction, nftItem } = await loadFixture(deployEnglishAuctionFixture);

      await expect(englishAuction.endAuction(nftItem.address, TOKEN_ID))
        .to.be.revertedWithCustomError(englishAuction, "EnglishAuction__AuctionNotInProgress")
        .withArgs(nftItem.address, TOKEN_ID);
    });

    it("reverts if the caller is not the seller", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: __englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const _englishAuction = await listItemInAuction(__englishAuction, nftItem.address);
      const englishAuction = await bidInAuction(_englishAuction, nftItem.address, bidder);

      const seller: string = (await englishAuction.getAuction(nftItem.address, TOKEN_ID)).seller;

      await ethers.provider.send("evm_increaseTime", [
        DURATION + 1 /* increase time by 7 days and 1 second to pass endingAt parameter */,
      ]);
      await ethers.provider.send("evm_mine", []);

      await expect(englishAuction.connect(bidder).endAuction(nftItem.address, TOKEN_ID))
        .to.be.revertedWithCustomError(englishAuction, "EnglishAuction__CallerIsNotTheSeller")
        .withArgs(bidder.address, seller);
    });

    it("reverts if the the auction is not over yet", async function () {
      const [, bidder]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        englishAuction: __englishAuction,
        nftItem,
      } = await loadFixture(deployEnglishAuctionFixture);

      // List item for auction
      const _englishAuction = await listItemInAuction(__englishAuction, nftItem.address);
      const englishAuction = await bidInAuction(_englishAuction, nftItem.address, bidder);

      const endingAt: BigNumber = (await englishAuction.getAuction(nftItem.address, TOKEN_ID))
        .endingAt;

      await expect(englishAuction.endAuction(nftItem.address, TOKEN_ID))
        .to.be.revertedWithCustomError(englishAuction, "EnglishAuction__AuctionIsNotOverYet")
        .withArgs(endingAt);
    });
  });
});
