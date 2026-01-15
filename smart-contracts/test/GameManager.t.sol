// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GameManager} from "../src/GameManager.sol";
import {DuelBaseToken} from "../src/DuelBaseToken.sol";

contract GameManagerTest is Test {
    GameManager public gameManager;
    DuelBaseToken public token;

    address public owner = address(this);
    uint256 public backendSignerPrivateKey = 0xBEEF;
    address public backendSigner = vm.addr(backendSignerPrivateKey);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 1e18;
    uint256 public constant PLAYER_BALANCE = 10_000 * 1e18;

    event GameCreated(
        uint256 indexed gameId,
        address indexed player1,
        address indexed player2,
        uint256 wagerAmount,
        uint256 player2Wager,
        GameManager.GameType gameType
    );
    event GameJoined(uint256 indexed gameId, address indexed player2);
    event GameCompleted(
        uint256 indexed gameId,
        address indexed winner,
        uint256 totalPayout
    );
    event GameCancelled(uint256 indexed gameId, address indexed canceller);
    event BackendSignerUpdated(
        address indexed oldSigner,
        address indexed newSigner
    );
    event EdgePercentUpdated(
        GameManager.GameType indexed gameType,
        uint256 newEdgePercent
    );
    event CancelTimeoutUpdated(uint256 oldTimeout, uint256 newTimeout);

    function setUp() public {
        token = new DuelBaseToken(INITIAL_SUPPLY);
        gameManager = new GameManager(address(token), backendSigner);

        // Fund players
        token.transfer(alice, PLAYER_BALANCE);
        token.transfer(bob, PLAYER_BALANCE);
        token.transfer(charlie, PLAYER_BALANCE);

        // Approve game manager
        vm.prank(alice);
        token.approve(address(gameManager), type(uint256).max);
        vm.prank(bob);
        token.approve(address(gameManager), type(uint256).max);
        vm.prank(charlie);
        token.approve(address(gameManager), type(uint256).max);
    }

    // ============ Helper Functions ============

    function _signGameResult(
        uint256 gameId,
        address winner
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(gameManager.GAME_RESULT_TYPEHASH(), gameId, winner)
        );
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                gameManager.DOMAIN_SEPARATOR(),
                structHash
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            backendSignerPrivateKey,
            digest
        );
        return abi.encodePacked(r, s, v);
    }

    function _createGame(
        address player1,
        address player2,
        uint256 wagerAmount,
        GameManager.GameType gameType
    ) internal returns (uint256) {
        vm.prank(player1);
        return gameManager.createGame(player2, wagerAmount, gameType);
    }

    function _joinGame(address player, uint256 gameId) internal {
        vm.prank(player);
        gameManager.joinGame(gameId);
    }

    // ============ Constructor Tests ============

    function test_constructor_setsToken() public view {
        assertEq(address(gameManager.duelToken()), address(token));
    }

    function test_constructor_setsBackendSigner() public view {
        assertEq(gameManager.backendSigner(), backendSigner);
    }

    function test_constructor_setsOwner() public view {
        assertEq(gameManager.owner(), owner);
    }

    function test_constructor_setsDefaultEdgePercents() public view {
        assertEq(
            gameManager.edgePercent(GameManager.GameType.TicTacToe),
            500
        ); // 5%
        assertEq(
            gameManager.edgePercent(GameManager.GameType.ConnectFour),
            300
        ); // 3%
    }

    function test_constructor_setsDefaultCancelTimeout() public view {
        assertEq(gameManager.cancelTimeout(), 24 hours);
    }

    function test_constructor_revertsWithZeroTokenAddress() public {
        vm.expectRevert(GameManager.InvalidAddress.selector);
        new GameManager(address(0), backendSigner);
    }

    function test_constructor_revertsWithZeroSignerAddress() public {
        vm.expectRevert(GameManager.InvalidAddress.selector);
        new GameManager(address(token), address(0));
    }

    // ============ CreateGame Tests ============

    function test_createGame_createsGameWithCorrectParams() public {
        uint256 wagerAmount = 100 * 1e18;

        uint256 gameId = _createGame(
            alice,
            bob,
            wagerAmount,
            GameManager.GameType.TicTacToe
        );

        GameManager.Game memory game = gameManager.getGame(gameId);

        assertEq(game.id, 0);
        assertEq(game.player1, alice);
        assertEq(game.player2, bob);
        assertEq(game.wagerAmount, wagerAmount);
        assertEq(game.player2Wager, (wagerAmount * 9500) / 10000); // 5% reduction for player2
        assertEq(uint256(game.gameType), uint256(GameManager.GameType.TicTacToe));
        assertEq(uint256(game.status), uint256(GameManager.GameStatus.Created));
        assertEq(game.winner, address(0));
    }

    function test_createGame_transfersTokensFromPlayer1() public {
        uint256 wagerAmount = 100 * 1e18;

        uint256 balanceBefore = token.balanceOf(alice);

        _createGame(alice, bob, wagerAmount, GameManager.GameType.TicTacToe);

        // Player1 pays the full wager amount (no edge added)
        assertEq(token.balanceOf(alice), balanceBefore - wagerAmount);
        assertEq(token.balanceOf(address(gameManager)), wagerAmount);
    }

    function test_createGame_emitsGameCreatedEvent() public {
        uint256 wagerAmount = 100 * 1e18;
        uint256 player2Wager = (wagerAmount * 9500) / 10000; // 5% reduction

        vm.expectEmit(true, true, true, true);
        emit GameCreated(
            0,
            alice,
            bob,
            wagerAmount,
            player2Wager,
            GameManager.GameType.TicTacToe
        );

        _createGame(alice, bob, wagerAmount, GameManager.GameType.TicTacToe);
    }

    function test_createGame_incrementsGameId() public {
        uint256 gameId1 = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );
        uint256 gameId2 = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );

        assertEq(gameId1, 0);
        assertEq(gameId2, 1);
    }

    function test_createGame_revertsWithZeroOpponent() public {
        vm.prank(alice);
        vm.expectRevert(GameManager.InvalidAddress.selector);
        gameManager.createGame(
            address(0),
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );
    }

    function test_createGame_revertsWithSelfAsOpponent() public {
        vm.prank(alice);
        vm.expectRevert(GameManager.InvalidAddress.selector);
        gameManager.createGame(
            alice,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );
    }

    function test_createGame_revertsWithZeroWager() public {
        vm.prank(alice);
        vm.expectRevert(GameManager.InvalidAmount.selector);
        gameManager.createGame(bob, 0, GameManager.GameType.TicTacToe);
    }

    function test_createGame_connectFourHasDifferentEdge() public {
        uint256 wagerAmount = 100 * 1e18;
        uint256 player2WagerConnectFour = (wagerAmount * 9700) / 10000; // 3% reduction

        uint256 gameId = _createGame(
            alice,
            bob,
            wagerAmount,
            GameManager.GameType.ConnectFour
        );

        GameManager.Game memory game = gameManager.getGame(gameId);
        assertEq(game.player2Wager, player2WagerConnectFour);
    }

    // ============ JoinGame Tests ============

    function test_joinGame_updatesGameStatus() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );

        _joinGame(bob, gameId);

        GameManager.Game memory game = gameManager.getGame(gameId);
        assertEq(uint256(game.status), uint256(GameManager.GameStatus.Active));
    }

    function test_joinGame_transfersTokensFromPlayer2() public {
        uint256 wagerAmount = 100 * 1e18;
        uint256 player2Wager = (wagerAmount * 9500) / 10000; // 5% reduction
        uint256 gameId = _createGame(
            alice,
            bob,
            wagerAmount,
            GameManager.GameType.TicTacToe
        );

        uint256 balanceBefore = token.balanceOf(bob);
        _joinGame(bob, gameId);

        // Player2 pays reduced wager
        assertEq(token.balanceOf(bob), balanceBefore - player2Wager);
    }

    function test_joinGame_emitsGameJoinedEvent() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );

        vm.expectEmit(true, true, false, true);
        emit GameJoined(gameId, bob);

        _joinGame(bob, gameId);
    }

    function test_joinGame_revertsWithInvalidGameId() public {
        vm.prank(bob);
        vm.expectRevert(GameManager.InvalidGameId.selector);
        gameManager.joinGame(999);
    }

    function test_joinGame_revertsIfNotPlayer2() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );

        vm.prank(charlie);
        vm.expectRevert(GameManager.NotPlayer2.selector);
        gameManager.joinGame(gameId);
    }

    function test_joinGame_revertsIfAlreadyActive() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );
        _joinGame(bob, gameId);

        vm.prank(bob);
        vm.expectRevert(GameManager.InvalidGameStatus.selector);
        gameManager.joinGame(gameId);
    }

    // ============ CompleteGame Tests ============

    function test_completeGame_player1Wins() public {
        uint256 wagerAmount = 100 * 1e18;
        uint256 player2Wager = (wagerAmount * 9500) / 10000; // 5% reduction
        uint256 totalPayout = wagerAmount + player2Wager;

        uint256 gameId = _createGame(
            alice,
            bob,
            wagerAmount,
            GameManager.GameType.TicTacToe
        );
        _joinGame(bob, gameId);

        uint256 aliceBalanceBefore = token.balanceOf(alice);
        bytes memory signature = _signGameResult(gameId, alice);

        gameManager.completeGame(gameId, alice, signature);

        assertEq(token.balanceOf(alice), aliceBalanceBefore + totalPayout);

        GameManager.Game memory game = gameManager.getGame(gameId);
        assertEq(uint256(game.status), uint256(GameManager.GameStatus.Completed));
        assertEq(game.winner, alice);
    }

    function test_completeGame_player2Wins() public {
        uint256 wagerAmount = 100 * 1e18;
        uint256 player2Wager = (wagerAmount * 9500) / 10000; // 5% reduction
        uint256 totalPayout = wagerAmount + player2Wager;

        uint256 gameId = _createGame(
            alice,
            bob,
            wagerAmount,
            GameManager.GameType.TicTacToe
        );
        _joinGame(bob, gameId);

        uint256 bobBalanceBefore = token.balanceOf(bob);
        bytes memory signature = _signGameResult(gameId, bob);

        gameManager.completeGame(gameId, bob, signature);

        assertEq(token.balanceOf(bob), bobBalanceBefore + totalPayout);
    }

    function test_completeGame_emitsGameCompletedEvent() public {
        uint256 wagerAmount = 100 * 1e18;
        uint256 player2Wager = (wagerAmount * 9500) / 10000; // 5% reduction
        uint256 totalPayout = wagerAmount + player2Wager;

        uint256 gameId = _createGame(
            alice,
            bob,
            wagerAmount,
            GameManager.GameType.TicTacToe
        );
        _joinGame(bob, gameId);

        bytes memory signature = _signGameResult(gameId, alice);

        vm.expectEmit(true, true, false, true);
        emit GameCompleted(gameId, alice, totalPayout);

        gameManager.completeGame(gameId, alice, signature);
    }

    function test_completeGame_revertsWithInvalidGameId() public {
        bytes memory signature = _signGameResult(999, alice);

        vm.expectRevert(GameManager.InvalidGameId.selector);
        gameManager.completeGame(999, alice, signature);
    }

    function test_completeGame_revertsIfGameNotActive() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );
        // Don't join - game is still Created

        bytes memory signature = _signGameResult(gameId, alice);

        vm.expectRevert(GameManager.InvalidGameStatus.selector);
        gameManager.completeGame(gameId, alice, signature);
    }

    function test_completeGame_revertsWithInvalidWinner() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );
        _joinGame(bob, gameId);

        bytes memory signature = _signGameResult(gameId, charlie);

        vm.expectRevert(GameManager.InvalidWinner.selector);
        gameManager.completeGame(gameId, charlie, signature);
    }

    function test_completeGame_revertsWithInvalidSignature() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );
        _joinGame(bob, gameId);

        // Sign with wrong key
        uint256 wrongKey = 0xDEAD;
        bytes32 structHash = keccak256(
            abi.encode(gameManager.GAME_RESULT_TYPEHASH(), gameId, alice)
        );
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                gameManager.DOMAIN_SEPARATOR(),
                structHash
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, digest);
        bytes memory wrongSignature = abi.encodePacked(r, s, v);

        vm.expectRevert(GameManager.InvalidSignature.selector);
        gameManager.completeGame(gameId, alice, wrongSignature);
    }

    function test_completeGame_revertsWithReusedSignature() public {
        uint256 wagerAmount = 100 * 1e18;
        uint256 gameId = _createGame(
            alice,
            bob,
            wagerAmount,
            GameManager.GameType.TicTacToe
        );
        _joinGame(bob, gameId);

        bytes memory signature = _signGameResult(gameId, alice);
        gameManager.completeGame(gameId, alice, signature);

        // Trying to complete already completed game fails with InvalidGameStatus
        // (status check happens before signature check)
        vm.expectRevert(GameManager.InvalidGameStatus.selector);
        gameManager.completeGame(gameId, alice, signature);
    }

    function test_signatureReplayProtection_marksSignatureAsUsed() public {
        uint256 wagerAmount = 100 * 1e18;
        uint256 gameId = _createGame(
            alice,
            bob,
            wagerAmount,
            GameManager.GameType.TicTacToe
        );
        _joinGame(bob, gameId);

        bytes memory signature = _signGameResult(gameId, alice);
        
        // Verify signature is valid before use
        assertTrue(gameManager.verifySignature(gameId, alice, signature));
        
        gameManager.completeGame(gameId, alice, signature);
        
        // Verify signature is marked as used after
        assertFalse(gameManager.verifySignature(gameId, alice, signature));
    }

    // ============ CancelGame Tests ============

    function test_cancelGame_refundsPlayer1() public {
        uint256 wagerAmount = 100 * 1e18;

        uint256 gameId = _createGame(
            alice,
            bob,
            wagerAmount,
            GameManager.GameType.TicTacToe
        );

        uint256 aliceBalanceBefore = token.balanceOf(alice);

        // Fast forward past timeout
        vm.warp(block.timestamp + 25 hours);

        vm.prank(alice);
        gameManager.cancelGame(gameId);

        // Player1 gets refunded their full wager
        assertEq(token.balanceOf(alice), aliceBalanceBefore + wagerAmount);
    }

    function test_cancelGame_updatesStatus() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );

        vm.warp(block.timestamp + 25 hours);

        vm.prank(alice);
        gameManager.cancelGame(gameId);

        GameManager.Game memory game = gameManager.getGame(gameId);
        assertEq(uint256(game.status), uint256(GameManager.GameStatus.Cancelled));
    }

    function test_cancelGame_emitsGameCancelledEvent() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );

        vm.warp(block.timestamp + 25 hours);

        vm.expectEmit(true, true, false, true);
        emit GameCancelled(gameId, alice);

        vm.prank(alice);
        gameManager.cancelGame(gameId);
    }

    function test_cancelGame_revertsIfNotPlayer1() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );

        vm.warp(block.timestamp + 25 hours);

        vm.prank(bob);
        vm.expectRevert(GameManager.NotPlayer.selector);
        gameManager.cancelGame(gameId);
    }

    function test_cancelGame_revertsIfTimeoutNotReached() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );

        vm.prank(alice);
        vm.expectRevert(GameManager.TimeoutNotReached.selector);
        gameManager.cancelGame(gameId);
    }

    function test_cancelGame_revertsIfGameActive() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );
        _joinGame(bob, gameId);

        vm.warp(block.timestamp + 25 hours);

        vm.prank(alice);
        vm.expectRevert(GameManager.InvalidGameStatus.selector);
        gameManager.cancelGame(gameId);
    }

    // ============ Admin Functions Tests ============

    function test_setBackendSigner_updatesSigner() public {
        address newSigner = makeAddr("newSigner");

        vm.expectEmit(true, true, false, true);
        emit BackendSignerUpdated(backendSigner, newSigner);

        gameManager.setBackendSigner(newSigner);

        assertEq(gameManager.backendSigner(), newSigner);
    }

    function test_setBackendSigner_revertsWithZeroAddress() public {
        vm.expectRevert(GameManager.InvalidAddress.selector);
        gameManager.setBackendSigner(address(0));
    }

    function test_setBackendSigner_revertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice)
        );
        gameManager.setBackendSigner(makeAddr("newSigner"));
    }

    function test_setEdgePercent_updatesEdge() public {
        uint256 newEdge = 1000; // 10%

        vm.expectEmit(true, false, false, true);
        emit EdgePercentUpdated(GameManager.GameType.TicTacToe, newEdge);

        gameManager.setEdgePercent(GameManager.GameType.TicTacToe, newEdge);

        assertEq(
            gameManager.edgePercent(GameManager.GameType.TicTacToe),
            newEdge
        );
    }

    function test_setEdgePercent_revertsIfTooHigh() public {
        vm.expectRevert(GameManager.EdgePercentTooHigh.selector);
        gameManager.setEdgePercent(GameManager.GameType.TicTacToe, 5001);
    }

    function test_setEdgePercent_revertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice)
        );
        gameManager.setEdgePercent(GameManager.GameType.TicTacToe, 1000);
    }

    function test_setCancelTimeout_updatesTimeout() public {
        uint256 newTimeout = 48 hours;

        vm.expectEmit(false, false, false, true);
        emit CancelTimeoutUpdated(24 hours, newTimeout);

        gameManager.setCancelTimeout(newTimeout);

        assertEq(gameManager.cancelTimeout(), newTimeout);
    }

    function test_setCancelTimeout_revertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice)
        );
        gameManager.setCancelTimeout(48 hours);
    }

    // ============ View Functions Tests ============

    function test_calculatePlayer2Wager() public view {
        uint256 wagerAmount = 100 * 1e18;
        uint256 expectedTicTacToe = (wagerAmount * 9500) / 10000; // 5% reduction
        uint256 expectedConnectFour = (wagerAmount * 9700) / 10000; // 3% reduction

        assertEq(
            gameManager.calculatePlayer2Wager(
                wagerAmount,
                GameManager.GameType.TicTacToe
            ),
            expectedTicTacToe
        );
        assertEq(
            gameManager.calculatePlayer2Wager(
                wagerAmount,
                GameManager.GameType.ConnectFour
            ),
            expectedConnectFour
        );
    }

    function test_verifySignature_returnsTrueForValidSignature() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );
        _joinGame(bob, gameId);

        bytes memory signature = _signGameResult(gameId, alice);

        assertTrue(gameManager.verifySignature(gameId, alice, signature));
    }

    function test_verifySignature_returnsFalseForInvalidSignature() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );
        _joinGame(bob, gameId);

        // Sign with wrong key
        uint256 wrongKey = 0xDEAD;
        bytes32 structHash = keccak256(
            abi.encode(gameManager.GAME_RESULT_TYPEHASH(), gameId, alice)
        );
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                gameManager.DOMAIN_SEPARATOR(),
                structHash
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, digest);
        bytes memory wrongSignature = abi.encodePacked(r, s, v);

        assertFalse(gameManager.verifySignature(gameId, alice, wrongSignature));
    }

    function test_verifySignature_returnsFalseForUsedSignature() public {
        uint256 gameId = _createGame(
            alice,
            bob,
            100 * 1e18,
            GameManager.GameType.TicTacToe
        );
        _joinGame(bob, gameId);

        bytes memory signature = _signGameResult(gameId, alice);

        // Complete the game (uses the signature)
        gameManager.completeGame(gameId, alice, signature);

        // Signature should now be invalid
        assertFalse(gameManager.verifySignature(gameId, alice, signature));
    }

    // ============ Fuzz Tests ============

    function testFuzz_createGame_variousWagerAmounts(uint256 wagerAmount) public {
        vm.assume(wagerAmount > 0);
        vm.assume(wagerAmount <= PLAYER_BALANCE / 2); // Account for edge

        uint256 gameId = _createGame(
            alice,
            bob,
            wagerAmount,
            GameManager.GameType.TicTacToe
        );

        GameManager.Game memory game = gameManager.getGame(gameId);
        assertEq(game.wagerAmount, wagerAmount);
    }

    function testFuzz_setEdgePercent_validRange(uint256 edgePercent_) public {
        vm.assume(edgePercent_ <= 5000);

        gameManager.setEdgePercent(GameManager.GameType.TicTacToe, edgePercent_);
        assertEq(
            gameManager.edgePercent(GameManager.GameType.TicTacToe),
            edgePercent_
        );
    }
}
