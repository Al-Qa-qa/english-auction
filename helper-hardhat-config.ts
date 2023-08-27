import { ethers, BigNumber } from "ethers";

type NetworkConfigItem = {
  name: string;
};

type NetworkConfigMap = {
  [chainId: string]: NetworkConfigItem;
};

export const networkConfig: NetworkConfigMap = {
  default: {
    name: "hardhat",
  },
  31337: {
    name: "localhost",
  },
  1: {
    name: "mainnet",
  },
  11155111: {
    name: "sepolia",
  },
  137: {
    name: "polygon",
  },
};

// Nft item used for testing constructor arguments
export const NFT_ITEM_NAME = "Test Collection";
export const NFT_ITEM_SYMBOL = "TC";
export const TOKEN_ID = BigNumber.from(0);

// Item that will be listed to the auction arguments
export const STARTING_PRICE = ethers.utils.parseEther("0.01"); // 0.01 ETH
export const DURATION = 7 * 24 * 60 * 30; // 7 days

export const ADDRESS_ZERO = ethers.constants.AddressZero;

export const developmentChains: string[] = ["hardhat", "localhost"];
export const VERIFICATION_BLOCK_CONFIRMATIONS = 6;
