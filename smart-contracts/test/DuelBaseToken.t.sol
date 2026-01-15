// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {DuelBaseToken} from "../src/DuelBaseToken.sol";

contract DuelBaseTokenTest is Test {
    DuelBaseToken public token;

    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 1e18; // 1 billion tokens

    event TokensMinted(address indexed to, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function setUp() public {
        token = new DuelBaseToken(INITIAL_SUPPLY);
    }

    // ============ Constructor Tests ============

    function test_constructor_setsNameAndSymbol() public view {
        assertEq(token.name(), "DuelBase Token");
        assertEq(token.symbol(), "DUEL");
    }

    function test_constructor_setsDecimals() public view {
        assertEq(token.decimals(), 18);
    }

    function test_constructor_mintsInitialSupplyToDeployer() public view {
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY);
    }

    function test_constructor_setsOwner() public view {
        assertEq(token.owner(), owner);
    }

    function test_constructor_withZeroSupply() public {
        DuelBaseToken zeroToken = new DuelBaseToken(0);
        assertEq(zeroToken.totalSupply(), 0);
        assertEq(zeroToken.balanceOf(address(this)), 0);
    }

    function testFuzz_constructor_withVariousSupplies(uint256 supply) public {
        DuelBaseToken newToken = new DuelBaseToken(supply);
        assertEq(newToken.totalSupply(), supply);
        assertEq(newToken.balanceOf(address(this)), supply);
    }

    // ============ Mint Tests ============

    function test_mint_ownerCanMint() public {
        uint256 mintAmount = 1000 * 1e18;

        vm.expectEmit(true, false, false, true);
        emit TokensMinted(alice, mintAmount);

        token.mint(alice, mintAmount);

        assertEq(token.balanceOf(alice), mintAmount);
        assertEq(token.totalSupply(), INITIAL_SUPPLY + mintAmount);
    }

    function test_mint_revertsWhenNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice));
        token.mint(alice, 1000 * 1e18);
    }

    function test_mint_revertsWhenMintingToZeroAddress() public {
        vm.expectRevert("DuelBaseToken: mint to zero address");
        token.mint(address(0), 1000 * 1e18);
    }

    function test_mint_revertsWhenAmountIsZero() public {
        vm.expectRevert("DuelBaseToken: mint amount must be greater than 0");
        token.mint(alice, 0);
    }

    function testFuzz_mint_variousAmounts(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount < type(uint256).max - INITIAL_SUPPLY);

        token.mint(alice, amount);
        assertEq(token.balanceOf(alice), amount);
    }

    // ============ Burn Tests ============

    function test_burn_burnsFromCaller() public {
        uint256 burnAmount = 100 * 1e18;

        token.burn(burnAmount);

        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - burnAmount);
        assertEq(token.totalSupply(), INITIAL_SUPPLY - burnAmount);
    }

    function test_burn_revertsWhenAmountIsZero() public {
        vm.expectRevert("DuelBaseToken: burn amount must be greater than 0");
        token.burn(0);
    }

    function test_burn_revertsWhenInsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert();
        token.burn(100 * 1e18);
    }

    function testFuzz_burn_variousAmounts(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount <= INITIAL_SUPPLY);

        token.burn(amount);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - amount);
    }

    // ============ BurnFrom Tests ============

    function test_burnFrom_burnsWithApproval() public {
        uint256 burnAmount = 100 * 1e18;

        // Transfer some tokens to alice
        token.transfer(alice, 1000 * 1e18);

        // Alice approves owner to burn
        vm.prank(alice);
        token.approve(owner, burnAmount);

        // Owner burns from alice
        token.burnFrom(alice, burnAmount);

        assertEq(token.balanceOf(alice), 1000 * 1e18 - burnAmount);
    }

    function test_burnFrom_revertsWhenAmountIsZero() public {
        token.transfer(alice, 1000 * 1e18);
        vm.prank(alice);
        token.approve(owner, 100 * 1e18);

        vm.expectRevert("DuelBaseToken: burn amount must be greater than 0");
        token.burnFrom(alice, 0);
    }

    function test_burnFrom_revertsWhenNotApproved() public {
        token.transfer(alice, 1000 * 1e18);

        vm.expectRevert();
        token.burnFrom(alice, 100 * 1e18);
    }

    function test_burnFrom_revertsWhenInsufficientAllowance() public {
        token.transfer(alice, 1000 * 1e18);

        vm.prank(alice);
        token.approve(owner, 50 * 1e18);

        vm.expectRevert();
        token.burnFrom(alice, 100 * 1e18);
    }

    // ============ Transfer Tests ============

    function test_transfer_transfersTokens() public {
        uint256 amount = 500 * 1e18;

        token.transfer(alice, amount);

        assertEq(token.balanceOf(alice), amount);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - amount);
    }

    function test_transfer_emitsTransferEvent() public {
        uint256 amount = 500 * 1e18;

        vm.expectEmit(true, true, false, true);
        emit Transfer(owner, alice, amount);

        token.transfer(alice, amount);
    }

    function test_transfer_revertsWhenInsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 100 * 1e18);
    }

    // ============ Approve and TransferFrom Tests ============

    function test_approve_setsAllowance() public {
        uint256 amount = 500 * 1e18;

        token.approve(alice, amount);

        assertEq(token.allowance(owner, alice), amount);
    }

    function test_approve_emitsApprovalEvent() public {
        uint256 amount = 500 * 1e18;

        vm.expectEmit(true, true, false, true);
        emit Approval(owner, alice, amount);

        token.approve(alice, amount);
    }

    function test_transferFrom_transfersWithApproval() public {
        uint256 amount = 500 * 1e18;

        token.approve(alice, amount);

        vm.prank(alice);
        token.transferFrom(owner, bob, amount);

        assertEq(token.balanceOf(bob), amount);
        assertEq(token.allowance(owner, alice), 0);
    }

    function test_transferFrom_revertsWhenNotApproved() public {
        vm.prank(alice);
        vm.expectRevert();
        token.transferFrom(owner, bob, 100 * 1e18);
    }

    // ============ Ownership Tests ============

    function test_transferOwnership_transfersOwnership() public {
        token.transferOwnership(alice);
        assertEq(token.owner(), alice);
    }

    function test_transferOwnership_newOwnerCanMint() public {
        token.transferOwnership(alice);

        vm.prank(alice);
        token.mint(bob, 1000 * 1e18);

        assertEq(token.balanceOf(bob), 1000 * 1e18);
    }

    function test_transferOwnership_oldOwnerCannotMint() public {
        token.transferOwnership(alice);

        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", owner));
        token.mint(bob, 1000 * 1e18);
    }

    function test_renounceOwnership_revokesOwnership() public {
        token.renounceOwnership();
        assertEq(token.owner(), address(0));
    }

    function test_renounceOwnership_preventsAllMinting() public {
        token.renounceOwnership();

        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", owner));
        token.mint(alice, 1000 * 1e18);
    }
}
