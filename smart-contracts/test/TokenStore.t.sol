// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TokenStore} from "../src/TokenStore.sol";
import {DuelBaseToken} from "../src/DuelBaseToken.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock USDC with 6 decimals
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TokenStoreTest is Test {
    TokenStore public store;
    DuelBaseToken public duelToken;
    MockUSDC public usdc;

    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public constant INITIAL_DUEL_SUPPLY = 1_000_000_000 * 1e18;
    uint256 public constant STORE_INVENTORY = 100_000_000 * 1e18; // 100M DUEL
    uint256 public constant INITIAL_PRICE = 10000; // 0.01 USDC per DUEL (6 decimals)
    uint256 public constant ALICE_USDC = 10_000 * 1e6; // 10,000 USDC

    event TokensPurchased(
        address indexed buyer,
        uint256 duelAmount,
        uint256 usdcPaid
    );
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event StoreStatusChanged(bool isOpen);
    event TokensWithdrawn(address indexed to, uint256 amount);
    event UsdcWithdrawn(address indexed to, uint256 amount);

    function setUp() public {
        duelToken = new DuelBaseToken(INITIAL_DUEL_SUPPLY);
        usdc = new MockUSDC();
        store = new TokenStore(address(duelToken), address(usdc), INITIAL_PRICE);

        // Fund the store with DUEL tokens
        duelToken.transfer(address(store), STORE_INVENTORY);

        // Fund alice with USDC
        usdc.mint(alice, ALICE_USDC);

        // Alice approves store
        vm.prank(alice);
        usdc.approve(address(store), type(uint256).max);
    }

    // ============ Constructor Tests ============

    function test_constructor_setsTokenAddresses() public view {
        assertEq(address(store.duelToken()), address(duelToken));
        assertEq(address(store.usdc()), address(usdc));
    }

    function test_constructor_setsInitialPrice() public view {
        assertEq(store.pricePerToken(), INITIAL_PRICE);
    }

    function test_constructor_storeIsOpen() public view {
        assertTrue(store.isOpen());
    }

    function test_constructor_setsOwner() public view {
        assertEq(store.owner(), owner);
    }

    function test_constructor_revertsWithZeroDuelAddress() public {
        vm.expectRevert(TokenStore.InvalidAddress.selector);
        new TokenStore(address(0), address(usdc), INITIAL_PRICE);
    }

    function test_constructor_revertsWithZeroUsdcAddress() public {
        vm.expectRevert(TokenStore.InvalidAddress.selector);
        new TokenStore(address(duelToken), address(0), INITIAL_PRICE);
    }

    function test_constructor_revertsWithZeroPrice() public {
        vm.expectRevert(TokenStore.InvalidPrice.selector);
        new TokenStore(address(duelToken), address(usdc), 0);
    }

    // ============ BuyTokens Tests ============

    function test_buyTokens_transfersCorrectAmounts() public {
        uint256 duelAmount = 1000 * 1e18; // 1000 DUEL
        uint256 expectedUsdcCost = (duelAmount * INITIAL_PRICE) / 1e18; // 10 USDC

        uint256 aliceUsdcBefore = usdc.balanceOf(alice);
        uint256 aliceDuelBefore = duelToken.balanceOf(alice);
        uint256 storeUsdcBefore = usdc.balanceOf(address(store));
        uint256 storeDuelBefore = duelToken.balanceOf(address(store));

        vm.prank(alice);
        store.buyTokens(duelAmount);

        assertEq(usdc.balanceOf(alice), aliceUsdcBefore - expectedUsdcCost);
        assertEq(duelToken.balanceOf(alice), aliceDuelBefore + duelAmount);
        assertEq(usdc.balanceOf(address(store)), storeUsdcBefore + expectedUsdcCost);
        assertEq(duelToken.balanceOf(address(store)), storeDuelBefore - duelAmount);
    }

    function test_buyTokens_emitsTokensPurchasedEvent() public {
        uint256 duelAmount = 1000 * 1e18;
        uint256 expectedUsdcCost = (duelAmount * INITIAL_PRICE) / 1e18;

        vm.expectEmit(true, false, false, true);
        emit TokensPurchased(alice, duelAmount, expectedUsdcCost);

        vm.prank(alice);
        store.buyTokens(duelAmount);
    }

    function test_buyTokens_worksWithDifferentAmounts() public {
        // Buy 100 DUEL = 1 USDC
        vm.prank(alice);
        store.buyTokens(100 * 1e18);
        assertEq(duelToken.balanceOf(alice), 100 * 1e18);

        // Buy 10000 DUEL = 100 USDC
        vm.prank(alice);
        store.buyTokens(10000 * 1e18);
        assertEq(duelToken.balanceOf(alice), 10100 * 1e18);
    }

    function test_buyTokens_revertsWhenStoreClosed() public {
        store.setStoreStatus(false);

        vm.prank(alice);
        vm.expectRevert(TokenStore.StoreClosed.selector);
        store.buyTokens(1000 * 1e18);
    }

    function test_buyTokens_revertsWithZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TokenStore.InvalidAmount.selector);
        store.buyTokens(0);
    }

    function test_buyTokens_revertsWhenInsufficientInventory() public {
        // Try to buy more than store has
        uint256 tooMuch = STORE_INVENTORY + 1;

        // Need to give alice enough USDC first
        usdc.mint(alice, type(uint256).max / 2);

        vm.prank(alice);
        vm.expectRevert(TokenStore.InsufficientInventory.selector);
        store.buyTokens(tooMuch);
    }

    function test_buyTokens_revertsWhenInsufficientUsdc() public {
        // Bob has no USDC
        vm.prank(bob);
        usdc.approve(address(store), type(uint256).max);

        vm.prank(bob);
        vm.expectRevert(); // SafeERC20 will revert
        store.buyTokens(1000 * 1e18);
    }

    function test_buyTokens_revertsWhenCostIsZero() public {
        // Try to buy such a small amount that USDC cost rounds to 0
        // With price of 10000 (0.01 USDC per DUEL), need < 1e14 DUEL for cost to be 0
        vm.prank(alice);
        vm.expectRevert(TokenStore.InvalidAmount.selector);
        store.buyTokens(1e13); // This should result in 0 USDC cost
    }

    // ============ Admin Functions Tests ============

    function test_setPrice_updatesPrice() public {
        uint256 newPrice = 20000; // 0.02 USDC per DUEL

        vm.expectEmit(false, false, false, true);
        emit PriceUpdated(INITIAL_PRICE, newPrice);

        store.setPrice(newPrice);

        assertEq(store.pricePerToken(), newPrice);
    }

    function test_setPrice_affectsPurchases() public {
        uint256 newPrice = 20000; // 0.02 USDC per DUEL (double)
        store.setPrice(newPrice);

        uint256 duelAmount = 1000 * 1e18;
        uint256 expectedUsdcCost = (duelAmount * newPrice) / 1e18; // 20 USDC

        uint256 aliceUsdcBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        store.buyTokens(duelAmount);

        assertEq(usdc.balanceOf(alice), aliceUsdcBefore - expectedUsdcCost);
    }

    function test_setPrice_revertsWithZeroPrice() public {
        vm.expectRevert(TokenStore.InvalidPrice.selector);
        store.setPrice(0);
    }

    function test_setPrice_revertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice)
        );
        store.setPrice(20000);
    }

    function test_setStoreStatus_closesStore() public {
        vm.expectEmit(false, false, false, true);
        emit StoreStatusChanged(false);

        store.setStoreStatus(false);

        assertFalse(store.isOpen());
    }

    function test_setStoreStatus_opensStore() public {
        store.setStoreStatus(false);
        store.setStoreStatus(true);

        assertTrue(store.isOpen());
    }

    function test_setStoreStatus_revertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice)
        );
        store.setStoreStatus(false);
    }

    function test_withdrawTokens_withdrawsDuel() public {
        uint256 amount = 1000 * 1e18;

        vm.expectEmit(true, false, false, true);
        emit TokensWithdrawn(bob, amount);

        store.withdrawTokens(bob, amount);

        assertEq(duelToken.balanceOf(bob), amount);
    }

    function test_withdrawTokens_revertsWithZeroAddress() public {
        vm.expectRevert(TokenStore.InvalidAddress.selector);
        store.withdrawTokens(address(0), 1000 * 1e18);
    }

    function test_withdrawTokens_revertsWithZeroAmount() public {
        vm.expectRevert(TokenStore.InvalidAmount.selector);
        store.withdrawTokens(bob, 0);
    }

    function test_withdrawTokens_revertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice)
        );
        store.withdrawTokens(bob, 1000 * 1e18);
    }

    function test_withdrawUsdc_withdrawsUsdc() public {
        // First make a purchase so store has USDC
        vm.prank(alice);
        store.buyTokens(1000 * 1e18);

        uint256 storeBalance = usdc.balanceOf(address(store));

        vm.expectEmit(true, false, false, true);
        emit UsdcWithdrawn(bob, storeBalance);

        store.withdrawUsdc(bob, storeBalance);

        assertEq(usdc.balanceOf(bob), storeBalance);
        assertEq(usdc.balanceOf(address(store)), 0);
    }

    function test_withdrawUsdc_revertsWithZeroAddress() public {
        // First make a purchase so store has USDC
        vm.prank(alice);
        store.buyTokens(1000 * 1e18);

        vm.expectRevert(TokenStore.InvalidAddress.selector);
        store.withdrawUsdc(address(0), 1e6);
    }

    function test_withdrawUsdc_revertsWithZeroAmount() public {
        vm.expectRevert(TokenStore.InvalidAmount.selector);
        store.withdrawUsdc(bob, 0);
    }

    function test_withdrawUsdc_revertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice)
        );
        store.withdrawUsdc(bob, 1e6);
    }

    function test_withdrawAllUsdc_withdrawsAllUsdc() public {
        // Make purchases to accumulate USDC
        vm.prank(alice);
        store.buyTokens(1000 * 1e18);

        uint256 totalUsdc = usdc.balanceOf(address(store));

        vm.expectEmit(true, false, false, true);
        emit UsdcWithdrawn(bob, totalUsdc);

        store.withdrawAllUsdc(bob);

        assertEq(usdc.balanceOf(bob), totalUsdc);
        assertEq(usdc.balanceOf(address(store)), 0);
    }

    function test_withdrawAllUsdc_revertsWithZeroAddress() public {
        vm.prank(alice);
        store.buyTokens(1000 * 1e18);

        vm.expectRevert(TokenStore.InvalidAddress.selector);
        store.withdrawAllUsdc(address(0));
    }

    function test_withdrawAllUsdc_revertsWithZeroBalance() public {
        vm.expectRevert(TokenStore.InvalidAmount.selector);
        store.withdrawAllUsdc(bob);
    }

    function test_withdrawAllUsdc_revertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice)
        );
        store.withdrawAllUsdc(bob);
    }

    // ============ View Functions Tests ============

    function test_getInventory_returnsCorrectAmount() public view {
        assertEq(store.getInventory(), STORE_INVENTORY);
    }

    function test_getInventory_updatesAfterPurchase() public {
        uint256 purchaseAmount = 1000 * 1e18;

        vm.prank(alice);
        store.buyTokens(purchaseAmount);

        assertEq(store.getInventory(), STORE_INVENTORY - purchaseAmount);
    }

    function test_getUsdcBalance_returnsCorrectAmount() public {
        assertEq(store.getUsdcBalance(), 0);

        vm.prank(alice);
        store.buyTokens(1000 * 1e18);

        uint256 expectedUsdc = (1000 * 1e18 * INITIAL_PRICE) / 1e18;
        assertEq(store.getUsdcBalance(), expectedUsdc);
    }

    function test_calculateCost_returnsCorrectCost() public view {
        uint256 duelAmount = 1000 * 1e18;
        uint256 expectedCost = (duelAmount * INITIAL_PRICE) / 1e18;

        assertEq(store.calculateCost(duelAmount), expectedCost);
    }

    function test_calculateCost_variousAmounts() public view {
        // 100 DUEL = 1 USDC at 0.01 price
        assertEq(store.calculateCost(100 * 1e18), 1 * 1e6);

        // 1000 DUEL = 10 USDC
        assertEq(store.calculateCost(1000 * 1e18), 10 * 1e6);

        // 1 DUEL = 0.01 USDC
        assertEq(store.calculateCost(1 * 1e18), 10000);
    }

    function test_calculateTokensForUsdc_returnsCorrectAmount() public view {
        uint256 usdcAmount = 10 * 1e6; // 10 USDC
        uint256 expectedDuel = (usdcAmount * 1e18) / INITIAL_PRICE;

        assertEq(store.calculateTokensForUsdc(usdcAmount), expectedDuel);
    }

    function test_calculateTokensForUsdc_variousAmounts() public view {
        // 1 USDC = 100 DUEL at 0.01 price
        assertEq(store.calculateTokensForUsdc(1 * 1e6), 100 * 1e18);

        // 10 USDC = 1000 DUEL
        assertEq(store.calculateTokensForUsdc(10 * 1e6), 1000 * 1e18);

        // 100 USDC = 10000 DUEL
        assertEq(store.calculateTokensForUsdc(100 * 1e6), 10000 * 1e18);
    }

    // ============ Fuzz Tests ============

    function testFuzz_buyTokens_variousAmounts(uint256 duelAmount) public {
        // Bound to reasonable amounts
        vm.assume(duelAmount >= 1e14); // Minimum to avoid zero cost
        vm.assume(duelAmount <= STORE_INVENTORY);

        uint256 usdcCost = (duelAmount * INITIAL_PRICE) / 1e18;
        vm.assume(usdcCost > 0);
        vm.assume(usdcCost <= ALICE_USDC);

        vm.prank(alice);
        store.buyTokens(duelAmount);

        assertEq(duelToken.balanceOf(alice), duelAmount);
    }

    function testFuzz_setPrice_validPrices(uint256 newPrice) public {
        vm.assume(newPrice > 0);

        store.setPrice(newPrice);
        assertEq(store.pricePerToken(), newPrice);
    }

    function testFuzz_calculateCost_consistency(uint256 duelAmount) public view {
        vm.assume(duelAmount > 0);
        vm.assume(duelAmount < type(uint256).max / INITIAL_PRICE);

        uint256 cost = store.calculateCost(duelAmount);
        uint256 expectedCost = (duelAmount * INITIAL_PRICE) / 1e18;

        assertEq(cost, expectedCost);
    }

    function testFuzz_calculateTokensForUsdc_consistency(uint256 usdcAmount) public view {
        vm.assume(usdcAmount > 0);
        vm.assume(usdcAmount < type(uint256).max / 1e18);

        uint256 tokens = store.calculateTokensForUsdc(usdcAmount);
        uint256 expectedTokens = (usdcAmount * 1e18) / INITIAL_PRICE;

        assertEq(tokens, expectedTokens);
    }
}
