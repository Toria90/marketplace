pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ERC721MinterAutoId is ERC721 {
    uint256 private _nextTokenId;
    mapping(uint256 => string) _tokenUri;

    constructor(string memory name, string memory symbol) ERC721(name, symbol){
    }

    function lastTokenId() public view returns (uint256){
        return _nextTokenId - 1;
    }

    function mintInternal(address to, string memory uri) internal {
        _tokenUri[_nextTokenId] = uri;
        _mint(to, _nextTokenId);
        _nextTokenId ++;
    }
    
    function transferFromInternal(address from, address to, uint256 tokenId) internal {
        _transfer(from, to, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return _tokenUri[tokenId];
    }
}