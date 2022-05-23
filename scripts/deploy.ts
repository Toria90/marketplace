import { ethers } from "hardhat";
import {BigNumber} from "ethers";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying contract with the account: ${deployer.address}`);

    const balance : BigNumber = await deployer.getBalance();
    console.log(`Account balance: ${balance.toString()}`);

    const auctionPeriodMin = 4320;
    const minBidders = 2;
    const payTokenAddress = "0x065Ce3AB42d3B0a73459b1FF631B400E8048D745";
    
    const factory = await ethers.getContractFactory("Marketplace");
    let contract = await factory.deploy(
        "", "", payTokenAddress, auctionPeriodMin, minBidders);
    console.log(`contract address: ${contract.address}`);
    console.log(`transaction Id: ${contract.deployTransaction.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) =>{
        console.error(error);
        process.exit(1);
    });