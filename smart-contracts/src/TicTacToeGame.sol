// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TicTacToeGame
 * @notice On-chain Tic Tac Toe game with wagers and timeout forfeit
 * @dev Players can make moves on-chain. If a player doesn't move within 2 minutes, they forfeit.
 */
contract TicTacToeGame is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum GameStatus {
        Created,    // Game created, waiting for player2 to join
        Active,     // Both players joined, game in progress
        Completed,  // Game finished (win or draw)
        Cancelled   // Game cancelled before starting
    }

    enum CellState {
        Empty,  // 0
        X,      // 1 - Player 1
        O       // 2 - Player 2
    }

    // ============ Structs ============

    struct Game {
        uint256 id;
        address player1;          // X - goes first
        address player2;          // O
        uint256 wagerAmount;      // Base wager per player
        GameStatus status;
        uint256 createdAt;
        uint256 lastMoveAt;       // Timestamp of last move (for timeout)
        address currentTurn;      // Address of player whose turn it is
        address winner;           // Winner address (address(0) if draw or ongoing)
        uint8[9] board;           // Board state: 0=empty, 1=X, 2=O
        bool isDraw;              // True if game ended in draw
    }

    // ============ State Variables ============

    /// @notice The DUEL token used for wagering
    IERC20 public immutable duelToken;

    /// @notice Timeout duration for a move (2 minutes)
    uint256 public constant MOVE_TIMEOUT = 2 minutes;

    /// @notice Timeout for player2 to join the game
    uint256 public joinTimeout = 24 hours;

    /// @notice Counter for game IDs
    uint256 public nextGameId;

    /// @notice Mapping of game ID to Game struct
    mapping(uint256 => Game) public games;

    // ============ Events ============

    event GameCreated(
        uint256 indexed gameId,
        address indexed player1,
        address indexed player2,
        uint256 wagerAmount
    );

    event GameJoined(uint256 indexed gameId, address indexed player2);

    event MoveMade(
        uint256 indexed gameId,
        address indexed player,
        uint8 position,
        uint8 cellState
    );

    event GameCompleted(
        uint256 indexed gameId,
        address indexed winner,
        bool isDraw,
        uint256 payout
    );

    event GameForfeited(
        uint256 indexed gameId,
        address indexed winner,
        address indexed loser,
        uint256 payout
    );

    event GameCancelled(uint256 indexed gameId, address indexed canceller);

    // ============ Errors ============

    error InvalidAddress();
    error InvalidAmount();
    error InvalidGameId();
    error InvalidGameStatus();
    error InvalidPosition();
    error CellOccupied();
    error NotYourTurn();
    error NotPlayer();
    error NotPlayer2();
    error TimeoutNotReached();
    error NoTimeoutOccurred();
    error GameAlreadyComplete();

    // ============ Constructor ============

    /**
     * @notice Creates a new TicTacToeGame contract
     * @param _duelToken The DUEL token address
     */
    constructor(address _duelToken) Ownable(msg.sender) {
        if (_duelToken == address(0)) {
            revert InvalidAddress();
        }
        duelToken = IERC20(_duelToken);
    }

    // ============ External Functions ============

    /**
     * @notice Creates a new Tic Tac Toe game with a wager
     * @param opponent The address of the opponent (player2)
     * @param wagerAmount The wager amount each player puts in
     * @return gameId The ID of the created game
     */
    function createGame(
        address opponent,
        uint256 wagerAmount
    ) external nonReentrant returns (uint256 gameId) {
        if (opponent == address(0) || opponent == msg.sender) {
            revert InvalidAddress();
        }
        if (wagerAmount == 0) {
            revert InvalidAmount();
        }

        gameId = nextGameId++;

        // Initialize empty board
        uint8[9] memory emptyBoard;

        games[gameId] = Game({
            id: gameId,
            player1: msg.sender,
            player2: opponent,
            wagerAmount: wagerAmount,
            status: GameStatus.Created,
            createdAt: block.timestamp,
            lastMoveAt: 0,
            currentTurn: msg.sender, // Player 1 (X) goes first
            winner: address(0),
            board: emptyBoard,
            isDraw: false
        });

        // Transfer player1's wager to the contract
        duelToken.safeTransferFrom(msg.sender, address(this), wagerAmount);

        emit GameCreated(gameId, msg.sender, opponent, wagerAmount);
    }

    /**
     * @notice Joins an existing game
     * @param gameId The ID of the game to join
     */
    function joinGame(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];

        if (game.player1 == address(0)) {
            revert InvalidGameId();
        }
        if (game.status != GameStatus.Created) {
            revert InvalidGameStatus();
        }
        if (msg.sender != game.player2) {
            revert NotPlayer2();
        }

        // Update game status and set the clock
        game.status = GameStatus.Active;
        game.lastMoveAt = block.timestamp;

        // Transfer player2's wager to the contract
        duelToken.safeTransferFrom(msg.sender, address(this), game.wagerAmount);

        emit GameJoined(gameId, msg.sender);
    }

    /**
     * @notice Makes a move on the board
     * @param gameId The ID of the game
     * @param position The board position (0-8)
     *        Board layout:
     *        0 | 1 | 2
     *        ---------
     *        3 | 4 | 5
     *        ---------
     *        6 | 7 | 8
     */
    function makeMove(uint256 gameId, uint8 position) external nonReentrant {
        Game storage game = games[gameId];

        if (game.player1 == address(0)) {
            revert InvalidGameId();
        }
        if (game.status != GameStatus.Active) {
            revert InvalidGameStatus();
        }
        if (msg.sender != game.currentTurn) {
            revert NotYourTurn();
        }
        if (position > 8) {
            revert InvalidPosition();
        }
        if (game.board[position] != 0) {
            revert CellOccupied();
        }

        // Determine cell state based on player
        uint8 cellState = msg.sender == game.player1 ? 1 : 2; // 1 = X, 2 = O

        // Make the move
        game.board[position] = cellState;
        game.lastMoveAt = block.timestamp;

        emit MoveMade(gameId, msg.sender, position, cellState);

        // Check for win
        if (_checkWin(game.board, cellState)) {
            game.status = GameStatus.Completed;
            game.winner = msg.sender;

            // Calculate total pot and transfer to winner
            uint256 totalPot = game.wagerAmount * 2;
            duelToken.safeTransfer(msg.sender, totalPot);

            emit GameCompleted(gameId, msg.sender, false, totalPot);
            return;
        }

        // Check for draw (board full)
        if (_isBoardFull(game.board)) {
            game.status = GameStatus.Completed;
            game.isDraw = true;

            // Refund both players
            duelToken.safeTransfer(game.player1, game.wagerAmount);
            duelToken.safeTransfer(game.player2, game.wagerAmount);

            emit GameCompleted(gameId, address(0), true, 0);
            return;
        }

        // Switch turn to other player
        game.currentTurn = msg.sender == game.player1 ? game.player2 : game.player1;
    }

    /**
     * @notice Claims a win by timeout if opponent hasn't moved in 2 minutes
     * @param gameId The ID of the game
     */
    function claimTimeoutWin(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];

        if (game.player1 == address(0)) {
            revert InvalidGameId();
        }
        if (game.status != GameStatus.Active) {
            revert InvalidGameStatus();
        }

        // Caller must be a player in the game
        if (msg.sender != game.player1 && msg.sender != game.player2) {
            revert NotPlayer();
        }

        // The caller must NOT be the one whose turn it is (they're waiting for opponent)
        if (msg.sender == game.currentTurn) {
            revert NotYourTurn(); // It's your turn, you can't claim timeout
        }

        // Check if timeout has occurred
        if (block.timestamp < game.lastMoveAt + MOVE_TIMEOUT) {
            revert NoTimeoutOccurred();
        }

        // Caller wins by timeout
        game.status = GameStatus.Completed;
        game.winner = msg.sender;

        address loser = msg.sender == game.player1 ? game.player2 : game.player1;

        // Transfer total pot to winner
        uint256 totalPot = game.wagerAmount * 2;
        duelToken.safeTransfer(msg.sender, totalPot);

        emit GameForfeited(gameId, msg.sender, loser, totalPot);
    }

    /**
     * @notice Cancels a game if player2 hasn't joined within the timeout
     * @param gameId The ID of the game to cancel
     */
    function cancelGame(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];

        if (game.player1 == address(0)) {
            revert InvalidGameId();
        }
        if (game.status != GameStatus.Created) {
            revert InvalidGameStatus();
        }
        if (msg.sender != game.player1) {
            revert NotPlayer();
        }
        if (block.timestamp < game.createdAt + joinTimeout) {
            revert TimeoutNotReached();
        }

        game.status = GameStatus.Cancelled;

        // Refund player1's wager
        duelToken.safeTransfer(game.player1, game.wagerAmount);

        emit GameCancelled(gameId, msg.sender);
    }

    // ============ View Functions ============

    /**
     * @notice Gets the full game state
     * @param gameId The ID of the game
     * @return The Game struct
     */
    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    /**
     * @notice Gets the board state for a game
     * @param gameId The ID of the game
     * @return The board as an array of 9 uint8 values
     */
    function getBoard(uint256 gameId) external view returns (uint8[9] memory) {
        return games[gameId].board;
    }

    /**
     * @notice Checks if a timeout has occurred for the current player's turn
     * @param gameId The ID of the game
     * @return True if the current player has timed out
     */
    function hasTimedOut(uint256 gameId) external view returns (bool) {
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) {
            return false;
        }
        return block.timestamp >= game.lastMoveAt + MOVE_TIMEOUT;
    }

    /**
     * @notice Gets the time remaining for the current player to make a move
     * @param gameId The ID of the game
     * @return Seconds remaining, or 0 if timed out
     */
    function getTimeRemaining(uint256 gameId) external view returns (uint256) {
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) {
            return 0;
        }
        uint256 deadline = game.lastMoveAt + MOVE_TIMEOUT;
        if (block.timestamp >= deadline) {
            return 0;
        }
        return deadline - block.timestamp;
    }

    // ============ Admin Functions ============

    /**
     * @notice Updates the join timeout duration
     * @param newTimeout The new timeout duration in seconds
     */
    function setJoinTimeout(uint256 newTimeout) external onlyOwner {
        joinTimeout = newTimeout;
    }

    // ============ Internal Functions ============

    /**
     * @notice Checks if a player has won
     * @param board The current board state
     * @param player The player to check (1 for X, 2 for O)
     * @return True if the player has won
     */
    function _checkWin(uint8[9] memory board, uint8 player) internal pure returns (bool) {
        // Winning combinations (indices)
        // Rows: [0,1,2], [3,4,5], [6,7,8]
        // Cols: [0,3,6], [1,4,7], [2,5,8]
        // Diagonals: [0,4,8], [2,4,6]

        // Check rows
        if (board[0] == player && board[1] == player && board[2] == player) return true;
        if (board[3] == player && board[4] == player && board[5] == player) return true;
        if (board[6] == player && board[7] == player && board[8] == player) return true;

        // Check columns
        if (board[0] == player && board[3] == player && board[6] == player) return true;
        if (board[1] == player && board[4] == player && board[7] == player) return true;
        if (board[2] == player && board[5] == player && board[8] == player) return true;

        // Check diagonals
        if (board[0] == player && board[4] == player && board[8] == player) return true;
        if (board[2] == player && board[4] == player && board[6] == player) return true;

        return false;
    }

    /**
     * @notice Checks if the board is full (draw condition)
     * @param board The current board state
     * @return True if all cells are occupied
     */
    function _isBoardFull(uint8[9] memory board) internal pure returns (bool) {
        for (uint8 i = 0; i < 9; i++) {
            if (board[i] == 0) {
                return false;
            }
        }
        return true;
    }
}
