import {ethers} from "hardhat";
import {solidity} from "ethereum-waffle";
import chai from "chai";
import {Marketplace,  ERC20Mock} from "../typechain-types"
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BytesLike, ContractFactory} from "ethers";
import Min = Mocha.reporters.Min;
import {Bytes} from "ethers/lib/utils";

chai.use(solidity);
const { expect } = chai;

describe("Marketplace contract", () => {
    let accounts : SignerWithAddress[];
    let owner : SignerWithAddress;
    let erc20owner : SignerWithAddress;
    
    let auctionPeriodMin : number;
    let minBidders : number;

    let marketplace : Marketplace;
    let erc20 : ERC20Mock;

    beforeEach(async () =>{
        accounts = await ethers.getSigners();
        [owner, erc20owner] = await ethers.getSigners();

        const erc20Factory : ContractFactory = await ethers.getContractFactory("ERC20Mock");
        erc20 = (await erc20Factory.connect(erc20owner).deploy()) as ERC20Mock;

        auctionPeriodMin = 3 * 24 * 60;
        minBidders = 2;
        
        const marketplaceFactory : ContractFactory = await ethers.getContractFactory("Marketplace");
        marketplace = (await marketplaceFactory.connect(owner).deploy("", "", erc20.address, auctionPeriodMin, minBidders)) as Marketplace;
    });

    describe("admin role", () => {
        it("Should set right auctionPeriodMin", async () =>{
            const newAuctionPeriodMin : number = auctionPeriodMin + 1;
            
            await marketplace.connect(owner).setAuctionPeriodMin(newAuctionPeriodMin);

            expect(await marketplace.auctionPeriodMin()).to.equal(newAuctionPeriodMin);
        });

        it("Should set right minBidders", async () =>{
            const newMinBidders : number = minBidders + 1;

            await marketplace.connect(owner).setMinBidders(newMinBidders);

            expect(await marketplace.minBidders()).to.equal(newMinBidders);
        });
    });

    describe("supportsInterface", () => {
        it("Should support ERC165 interface", async () =>{
            expect(await marketplace.supportsInterface("0x01ffc9a7")).to.equal(true);
        });

        it("Shouldn't support 0xffffffff interface", async () =>{
            expect(await marketplace.supportsInterface("0xffffffff")).to.equal(false);
        });
    });
    
    describe("createItem", () => {
        it("Should set right token owner", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            
            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            expect(await marketplace.ownerOf(tokenId)).to.equal(tokenOwner.address);
        });

        it("Should set right uri", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            expect(await marketplace.tokenURI(tokenId)).to.equal(tokenUri);
        });
    });

    describe("listItem", () => {
        it("Should be able token owner only", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();
            
            await expect(marketplace.listItem(tokenId, price))
                .to.revertedWith("aren't token owner");
        });

        it("Shouldn't be able with zero price", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 0;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await expect(marketplace.connect(tokenOwner).listItem(tokenId, price))
                .to.revertedWith("zero price");
        });
        
        it("Shouldn't be able if token not exists", async () =>{
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;
            const tokenId : number = 1;
            
            await expect(marketplace.connect(tokenOwner).listItem(tokenId, price))
                .to.reverted;
        });

        it("Should hold token", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItem(tokenId,price);

            expect(await marketplace.ownerOf(tokenId)).to.equal(marketplace.address);
        });
    });

    describe("cancel", () => {
        it("Should be able token owner only", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItem(tokenId,price);

            await expect(marketplace.cancel(tokenId))
                .to.revertedWith("aren't token owner");
        });

        it("Shouldn't be able without listen", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await expect(marketplace.connect(tokenOwner).cancel(tokenId))
                .to.revertedWith("isn't listed");
        });

        it("Should transfer token back", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItem(tokenId,price);
            await marketplace.connect(tokenOwner).cancel(tokenId);

            expect(await marketplace.ownerOf(tokenId)).to.equal(tokenOwner.address);
        });
    });

    describe("buyItem", () => {
        it("Shouldn't be able without listed", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await expect(marketplace.buyItem(tokenId))
                .to.revertedWith("isn't listed");
        });

        it("Shouldn't be able without approve price", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();
            
            await marketplace.connect(tokenOwner).listItem(tokenId, price);

            await expect(marketplace.buyItem(tokenId))
                .to.revertedWith("price isn't approved");
        });

        it("Should change owner", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;
            const account : SignerWithAddress = accounts[2];

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItem(tokenId, price);
            await erc20.connect(erc20owner).mint(account.address, price);
            await erc20.connect(account).approve(marketplace.address, price);
            
            await marketplace.connect(account).buyItem(tokenId);

            expect(await marketplace.ownerOf(tokenId)).to.equal(account.address);
        });

        it("Should change IERC20 token owner balance", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;
            const account : SignerWithAddress = accounts[2];

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItem(tokenId, price);
            await erc20.connect(erc20owner).mint(account.address, price);
            await erc20.connect(account).approve(marketplace.address, price);

            await marketplace.connect(account).buyItem(tokenId);

            expect(await erc20.balanceOf(tokenOwner.address)).to.equal(price);
        });

        it("Should change IERC20 new token owner balance", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;
            const account : SignerWithAddress = accounts[2];

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItem(tokenId, price);
            await erc20.connect(erc20owner).mint(account.address, price);
            await erc20.connect(account).approve(marketplace.address, price);

            await marketplace.connect(account).buyItem(tokenId);

            expect(await erc20.balanceOf(account.address)).to.equal(0);
        });
    });

    
    describe("listItemOnAuction", () => {
        it("Should be able token owner only", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await expect(marketplace.listItemOnAuction(tokenId, price))
                .to.revertedWith("aren't token owner");
        });

        it("Should be able with zero price", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 0;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await expect(marketplace.connect(tokenOwner).listItemOnAuction(tokenId, price))
                .to.revertedWith("zero min price");
        });

        it("Should hold token", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const price : number = 100;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItemOnAuction(tokenId, price);

            expect(await marketplace.ownerOf(tokenId)).to.equal(marketplace.address);
        });
    });

    describe("makeBid", () => {
        it("Shouldn't be able without auction", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const bidder : SignerWithAddress = accounts[2];
            const minPrice : number = 100;
            const price : number = 200;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await expect(marketplace.connect(bidder).makeBid(tokenId, price))
                .to.revertedWith("isn't for auction");
        });

        it("Shouldn't be able with low price", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const bidder : SignerWithAddress = accounts[2];
            const minPrice : number = 100;
            const price : number =  minPrice;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();
            
            await marketplace.connect(tokenOwner).listItemOnAuction(tokenId, minPrice);

            await expect(marketplace.connect(bidder).makeBid(tokenId, price))
                .to.revertedWith("low price");
        });

        it("Shouldn't be able without approve price", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const bidder : SignerWithAddress = accounts[2];
            const minPrice : number = 100;
            const price : number =  minPrice + 1;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItemOnAuction(tokenId, minPrice);

            await expect(marketplace.connect(bidder).makeBid(tokenId, price))
                .to.revertedWith("price isn't approved");
        });

        it("Should hold ERC20", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const bidder : SignerWithAddress = accounts[2];
            const minPrice : number = 100;
            const price : number =  minPrice + 1;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItemOnAuction(tokenId, minPrice);
            await erc20.connect(erc20owner).mint(bidder.address, price);
            await erc20.connect(bidder).approve(marketplace.address, price);

            await marketplace.connect(bidder).makeBid(tokenId, price);

            expect(await erc20.balanceOf(bidder.address)).to.equal(0);
            expect(await erc20.balanceOf(marketplace.address)).to.equal(price);
        });

        it("Should cancel hold ERC20 when bidder changed", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const bidder : SignerWithAddress = accounts[2];
            const bidder2 : SignerWithAddress = accounts[3];
            const minPrice : number = 100;
            const price : number =  minPrice + 1;
            const price2 : number =  price + 1;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItemOnAuction(tokenId, minPrice);
            
            await erc20.connect(erc20owner).mint(bidder.address, price);
            await erc20.connect(bidder).approve(marketplace.address, price);
            await marketplace.connect(bidder).makeBid(tokenId, price);

            await erc20.connect(erc20owner).mint(bidder2.address, price2);
            await erc20.connect(bidder2).approve(marketplace.address, price2);
            await marketplace.connect(bidder2).makeBid(tokenId, price2);

            expect(await erc20.balanceOf(bidder.address)).to.equal(price);
        });
    });

    describe("finishAuction", () => {
        it("Shouldn't be able without auction", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const bidder : SignerWithAddress = accounts[2];
            const minPrice : number = 100;
            const price : number = 200;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await expect(marketplace.connect(tokenOwner).finishAuction(tokenId))
                .to.revertedWith("isn't for auction");
        });

        it("Should be able token owner only", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const someAccount : SignerWithAddress = accounts[2];
            const minPrice : number = 100;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItemOnAuction(tokenId, minPrice);

            await expect(marketplace.connect(someAccount).finishAuction(tokenId))
                .to.revertedWith("aren't token owner");
        });

        it("Shouldn't be able before auction period closed and when it has not enough bedders", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const bidder : SignerWithAddress = accounts[2];
            const minPrice : number = 100;
            const price : number =  minPrice + 1;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItemOnAuction(tokenId, minPrice);

            await erc20.connect(erc20owner).mint(bidder.address, price);
            await erc20.connect(bidder).approve(marketplace.address, price);
            await marketplace.connect(bidder).makeBid(tokenId, price);

            await ethers.provider.send('evm_increaseTime', [auctionPeriodMin * 60 - 10]);

            await expect(marketplace.connect(tokenOwner).finishAuction(tokenId))
                .to.revertedWith("auction period isn't closed");
        });
        
        it("Should be change token owner after auction period closed", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const bidder : SignerWithAddress = accounts[2];
            const bidder2 : SignerWithAddress = accounts[3];
            const minPrice : number = 100;
            const price : number =  minPrice + 1;
            const price2 : number =  price + 1;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItemOnAuction(tokenId, minPrice);

            await ethers.provider.send('evm_increaseTime', [auctionPeriodMin * 60]);
            
            await marketplace.connect(tokenOwner).finishAuction(tokenId);

            expect(await marketplace.ownerOf(tokenId)).to.equal(tokenOwner.address);
        });

        it("Should be get back hold to bidder", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const bidder : SignerWithAddress = accounts[2];
            const minPrice : number = 100;
            const price : number =  minPrice + 1;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItemOnAuction(tokenId, minPrice);

            await erc20.connect(erc20owner).mint(bidder.address, price);
            await erc20.connect(bidder).approve(marketplace.address, price);
            await marketplace.connect(bidder).makeBid(tokenId, price);

            await ethers.provider.send('evm_increaseTime', [auctionPeriodMin * 60]);
            
            await marketplace.connect(tokenOwner).finishAuction(tokenId);

            expect(await erc20.balanceOf(bidder.address)).to.equal(price);
            expect(await erc20.balanceOf(marketplace.address)).to.equal(0);
        });

        it("Should be transfer token to bidder", async () =>{
            const tokenUri : string = "some token uri";
            const tokenOwner : SignerWithAddress = accounts[1];
            const bidder : SignerWithAddress = accounts[2];
            const bidder2 : SignerWithAddress = accounts[3];
            const minPrice : number = 100;
            const price : number =  minPrice + 1;
            const price2 : number =  price + 1;

            await marketplace.createItem(tokenUri, tokenOwner.address);
            const tokenId : number = (await marketplace.lastTokenId()).toNumber();

            await marketplace.connect(tokenOwner).listItemOnAuction(tokenId, minPrice);

            await erc20.connect(erc20owner).mint(bidder.address, price);
            await erc20.connect(bidder).approve(marketplace.address, price);
            await marketplace.connect(bidder).makeBid(tokenId, price);

            await erc20.connect(erc20owner).mint(bidder2.address, price2);
            await erc20.connect(bidder2).approve(marketplace.address, price2);
            await marketplace.connect(bidder2).makeBid(tokenId, price2);
            
            await marketplace.connect(tokenOwner).finishAuction(tokenId);

            expect(await marketplace.ownerOf(tokenId)).to.equal(bidder2.address);
            expect(await erc20.balanceOf(bidder2.address)).to.equal(0);
            expect(await erc20.balanceOf(tokenOwner.address)).to.equal(price2);
        });
    });
    
});