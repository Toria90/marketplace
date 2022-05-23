﻿import {task} from "hardhat/config";
import {ethers} from "hardhat";

task("ERC1155Minter.mint", "mint")
    .addParam("contract", "contract address")
    .addParam("tokenUri", "token uri")
    .addParam("owner", "token owner")
    .setAction(async (taskArgs, {ethers}) => {
        const factory = await ethers.getContractFactory("Marketplace");
        const contract = await factory.attach(taskArgs.contract);

        const owner: string = ethers.utils.getAddress(taskArgs.owner);
        const tokenUri : string = taskArgs.tokenUri;

        await contract.mint(tokenUri, owner);
        console.log(`done`);
    });