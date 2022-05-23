pragma solidity ^0.8.0;

import "./ERC721MinterAutoId.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Marketplace is ERC721MinterAutoId, AccessControl {
    
    struct ListedToken{
        uint256 price;
        address owner;
    }
    
    struct Auction{
        address owner;
        uint256 lastPrice;
        uint256 biddersCount;
        address lastBidder;
        uint256 openDate;
    }

    address private _payTokenAddress;
    uint256 private _auctionPeriodMin;
    uint256 private _minBidders;
    mapping(uint256 => ListedToken) private _listedTokens;
    mapping(uint256 => Auction) private _auctions;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    constructor(
        string memory name, 
        string memory symbol, 
        address payTokenAddress, 
        uint256 auctionPeriodMin, 
        uint256 minBidders) ERC721MinterAutoId(name, symbol){

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(ADMIN_ROLE, _msgSender());
        
        _payTokenAddress = payTokenAddress;
        _auctionPeriodMin = auctionPeriodMin;
        _minBidders = minBidders;
    }
    
    function auctionPeriodMin() public view returns(uint256) {
        return _auctionPeriodMin;
    }
    
    function minBidders() public view returns(uint256) {
        return _minBidders;
    }

    function setAuctionPeriodMin(uint256 auctionPeriodMin) public onlyRole(ADMIN_ROLE) {
        _auctionPeriodMin = auctionPeriodMin;
    }

    function setMinBidders(uint256 minBidders) public onlyRole(ADMIN_ROLE) {
        _minBidders = minBidders;
    }
    
    function createItem(string memory tokenUri, address owner) public {
        mintInternal(owner, tokenUri);
    }
    
    function listItem(uint256 tokenId, uint256 price) public {
        require(ownerOf(tokenId) == msg.sender, "aren't token owner");
        require(price > 0, "zero price");

        _listedTokens[tokenId].price = price;
        _listedTokens[tokenId].owner = msg.sender;
        
        transferFromInternal(msg.sender, address(this), tokenId);
        
        emit ListItem(tokenId, price);
    }
    
    function cancel(uint256 tokenId) public {
        require(_listedTokens[tokenId].price > 0, "isn't listed");
        require(_listedTokens[tokenId].owner == msg.sender, "aren't token owner");
        
        delete _listedTokens[tokenId];
        
        transferFromInternal(address(this), msg.sender, tokenId);
        
        emit CancelList(tokenId);
    }
    
    function buyItem(uint256 tokenId) public {
        require(_listedTokens[tokenId].price > 0, "isn't listed");
        require(IERC20(_payTokenAddress).allowance(msg.sender, address(this)) >= _listedTokens[tokenId].price, "price isn't approved");

        uint256 price = _listedTokens[tokenId].price;
        address tokenOwner = _listedTokens[tokenId].owner;
        delete _listedTokens[tokenId];
        transferFromInternal(address(this), msg.sender, tokenId);
        
        _transferMoney(msg.sender, tokenOwner, price);
        
        emit SellItem(tokenId);
    }
    
    
    function listItemOnAuction(uint256 tokenId, uint256 minPrice) public {
        require(ownerOf(tokenId) == msg.sender, "aren't token owner");
        require(minPrice > 0, "zero min price");

        _auctions[tokenId].owner = msg.sender;
        _auctions[tokenId].lastPrice = minPrice;
        _auctions[tokenId].openDate = block.timestamp;

        transferFromInternal(msg.sender, address(this), tokenId);
        
        emit OpenAuction(tokenId, minPrice);
    }

    function makeBid(uint256 tokenId, uint256 price) public {
        require(_auctions[tokenId].lastPrice > 0, "isn't for auction");
        require(price > _auctions[tokenId].lastPrice, "low price");
        require(IERC20(_payTokenAddress).allowance(msg.sender, address(this)) >= price, "price isn't approved");

        if (_auctions[tokenId].biddersCount > 0)
            _transferMoney(address(this), _auctions[tokenId].lastBidder, _auctions[tokenId].lastPrice);
        
        _auctions[tokenId].lastBidder = msg.sender;
        _auctions[tokenId].lastPrice = price;
        _auctions[tokenId].biddersCount++;
        
        _transferMoney(msg.sender, address(this), price);
        
        emit NewBid(tokenId, price);
    }

    function finishAuction(uint256 tokenId) public {
        require(_auctions[tokenId].lastPrice > 0, "isn't for auction");
        require(_auctions[tokenId].owner == msg.sender, "aren't token owner");
        
        bool periodAuctionClosed = _auctions[tokenId].openDate + _auctionPeriodMin * 60 <= block.timestamp;
        bool enoughBidders = _auctions[tokenId].biddersCount >= _minBidders;
        require(periodAuctionClosed || enoughBidders, "auction period isn't closed");
        
        if (enoughBidders) {
            transferFromInternal(address(this), _auctions[tokenId].lastBidder, tokenId);
            _transferMoney(address(this), _auctions[tokenId].owner, _auctions[tokenId].lastPrice);
        }
        else {
            transferFromInternal(address(this), _auctions[tokenId].owner, tokenId);
            if (_auctions[tokenId].biddersCount > 0)
                _transferMoney(address(this), _auctions[tokenId].lastBidder, _auctions[tokenId].lastPrice);
        }

        delete _auctions[tokenId];
        
        emit FinishAuction(tokenId);
    }
    
    function _transferMoney(address from, address to, uint256 amount) private{
        SafeERC20.safeTransferFrom(IERC20(_payTokenAddress), from, to, amount);
    }


    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl) returns (bool){
        return super.supportsInterface(interfaceId);
    }
    
    event ListItem(uint256 tokenId, uint256 price);
    event CancelList(uint256 tokenId);
    event SellItem(uint256 tokenId);
    
    event OpenAuction(uint256 tokenId, uint256 minPrice);
    event NewBid(uint256 tokenId, uint256 price);
    event FinishAuction(uint256 tokenId);
}
