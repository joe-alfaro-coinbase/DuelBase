// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title GameManager
 * @notice Manages game creation, joining, and wager distribution for DuelBase games
 * @dev Uses EIP-712 typed data for backend signature verification
 */
contract GameManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Enums ============

    enum GameType {
        TicTacToe,
        ConnectFour
    }

    enum GameStatus {
        Created,
        Active,
        Completed,
        Cancelled
    }

    // ============ Structs ============

    struct Game {
        uint256 id;
        address player1;
        address player2;
        uint256 wagerAmount; // Base wager (what player2 pays)
        uint256 player1Wager; // wager + edge
        GameType gameType;
        GameStatus status;
        uint256 createdAt;
        address winner;
    }

    // ============ State Variables ============

    /// @notice The DUEL token used for wagering
    IERC20 public immutable duelToken;

    /// @notice The backend signer address for winner verification
    address public backendSigner;

    /// @notice Timeout duration after which a game can be cancelled (default: 24 hours)
    uint256 public cancelTimeout = 24 hours;

    /// @notice Counter for game IDs
    uint256 public nextGameId;

    /// @notice Mapping of game ID to Game struct
    mapping(uint256 => Game) public games;

    /// @notice First player edge percentage per game type (in basis points, e.g., 500 = 5%)
    mapping(GameType => uint256) public edgePercent;

    /// @notice Mapping to track used signatures (prevents replay)
    mapping(bytes32 => bool) public usedSignatures;

    // ============ Constants ============

    /// @notice Maximum edge percentage (50%)
    uint256 public constant MAX_EDGE_PERCENT = 5000;

    /// @notice Basis points denominator
    uint256 public constant BASIS_POINTS = 10000;

    // ============ EIP-712 Constants ============

    bytes32 public constant GAME_RESULT_TYPEHASH =
        keccak256("GameResult(uint256 gameId,address winner)");

    bytes32 public immutable DOMAIN_SEPARATOR;

    // ============ Events ============

    event GameCreated(
        uint256 indexed gameId,
        address indexed player1,
        address indexed player2,
        uint256 wagerAmount,
        uint256 player1Wager,
        GameType gameType
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

    event EdgePercentUpdated(GameType indexed gameType, uint256 newEdgePercent);

    event CancelTimeoutUpdated(uint256 oldTimeout, uint256 newTimeout);

    // ============ Errors ============

    error InvalidAddress();
    error InvalidAmount();
    error InvalidGameId();
    error InvalidGameStatus();
    error InvalidSignature();
    error InvalidWinner();
    error NotPlayer();
    error NotPlayer2();
    error TimeoutNotReached();
    error EdgePercentTooHigh();
    error SignatureAlreadyUsed();

    // ============ Constructor ============

    /**
     * @notice Creates a new GameManager contract
     * @param _duelToken The DUEL token address
     * @param _backendSigner The backend signer address for winner verification
     */
    constructor(address _duelToken, address _backendSigner) Ownable(msg.sender) {
        if (_duelToken == address(0) || _backendSigner == address(0)) {
            revert InvalidAddress();
        }

        duelToken = IERC20(_duelToken);
        backendSigner = _backendSigner;

        // Set default edge percentages (in basis points)
        edgePercent[GameType.TicTacToe] = 500; // 5% edge for first player
        edgePercent[GameType.ConnectFour] = 300; // 3% edge for first player

        // Build EIP-712 domain separator
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("DuelBase")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // ============ External Functions ============

    /**
     * @notice Creates a new game with a wager
     * @param opponent The address of the opponent (player2)
     * @param wagerAmount The base wager amount (what player2 will pay)
     * @param gameType The type of game to play
     * @return gameId The ID of the created game
     */
    function createGame(
        address opponent,
        uint256 wagerAmount,
        GameType gameType
    ) external nonReentrant returns (uint256 gameId) {
        if (opponent == address(0) || opponent == msg.sender) {
            revert InvalidAddress();
        }
        if (wagerAmount == 0) {
            revert InvalidAmount();
        }

        gameId = nextGameId++;

        // Calculate player1's wager with edge
        uint256 edge = (wagerAmount * edgePercent[gameType]) / BASIS_POINTS;
        uint256 player1Wager = wagerAmount + edge;

        // Create the game
        games[gameId] = Game({
            id: gameId,
            player1: msg.sender,
            player2: opponent,
            wagerAmount: wagerAmount,
            player1Wager: player1Wager,
            gameType: gameType,
            status: GameStatus.Created,
            createdAt: block.timestamp,
            winner: address(0)
        });

        // Transfer player1's wager to the contract
        duelToken.safeTransferFrom(msg.sender, address(this), player1Wager);

        emit GameCreated(
            gameId,
            msg.sender,
            opponent,
            wagerAmount,
            player1Wager,
            gameType
        );
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

        // Update game status
        game.status = GameStatus.Active;

        // Transfer player2's wager to the contract
        duelToken.safeTransferFrom(msg.sender, address(this), game.wagerAmount);

        emit GameJoined(gameId, msg.sender);
    }

    /**
     * @notice Completes a game with a backend-signed result
     * @param gameId The ID of the game to complete
     * @param winner The address of the winner
     * @param signature The backend signature proving the winner
     */
    function completeGame(
        uint256 gameId,
        address winner,
        bytes calldata signature
    ) external nonReentrant {
        Game storage game = games[gameId];

        if (game.player1 == address(0)) {
            revert InvalidGameId();
        }
        if (game.status != GameStatus.Active) {
            revert InvalidGameStatus();
        }
        if (winner != game.player1 && winner != game.player2) {
            revert InvalidWinner();
        }

        // Verify the backend signature
        bytes32 structHash = keccak256(
            abi.encode(GAME_RESULT_TYPEHASH, gameId, winner)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        // Check for signature replay
        if (usedSignatures[digest]) {
            revert SignatureAlreadyUsed();
        }
        usedSignatures[digest] = true;

        address recoveredSigner = digest.recover(signature);
        if (recoveredSigner != backendSigner) {
            revert InvalidSignature();
        }

        // Update game status
        game.status = GameStatus.Completed;
        game.winner = winner;

        // Calculate total payout
        uint256 totalPayout = game.player1Wager + game.wagerAmount;

        // Transfer winnings to the winner
        duelToken.safeTransfer(winner, totalPayout);

        emit GameCompleted(gameId, winner, totalPayout);
    }

    /**
     * @notice Cancels a game if the opponent hasn't joined within the timeout
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
        if (block.timestamp < game.createdAt + cancelTimeout) {
            revert TimeoutNotReached();
        }

        // Update game status
        game.status = GameStatus.Cancelled;

        // Refund player1's wager
        duelToken.safeTransfer(game.player1, game.player1Wager);

        emit GameCancelled(gameId, msg.sender);
    }

    // ============ Admin Functions ============

    /**
     * @notice Updates the backend signer address
     * @param newSigner The new backend signer address
     */
    function setBackendSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) {
            revert InvalidAddress();
        }

        address oldSigner = backendSigner;
        backendSigner = newSigner;

        emit BackendSignerUpdated(oldSigner, newSigner);
    }

    /**
     * @notice Updates the edge percentage for a game type
     * @param gameType The game type to update
     * @param newEdgePercent The new edge percentage (in basis points)
     */
    function setEdgePercent(
        GameType gameType,
        uint256 newEdgePercent
    ) external onlyOwner {
        if (newEdgePercent > MAX_EDGE_PERCENT) {
            revert EdgePercentTooHigh();
        }

        edgePercent[gameType] = newEdgePercent;

        emit EdgePercentUpdated(gameType, newEdgePercent);
    }

    /**
     * @notice Updates the cancel timeout duration
     * @param newTimeout The new timeout duration in seconds
     */
    function setCancelTimeout(uint256 newTimeout) external onlyOwner {
        uint256 oldTimeout = cancelTimeout;
        cancelTimeout = newTimeout;

        emit CancelTimeoutUpdated(oldTimeout, newTimeout);
    }

    // ============ View Functions ============

    /**
     * @notice Gets the details of a game
     * @param gameId The ID of the game
     * @return The Game struct
     */
    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    /**
     * @notice Calculates the player1 wager for a given base wager and game type
     * @param wagerAmount The base wager amount
     * @param gameType The game type
     * @return The player1 wager amount (including edge)
     */
    function calculatePlayer1Wager(
        uint256 wagerAmount,
        GameType gameType
    ) external view returns (uint256) {
        uint256 edge = (wagerAmount * edgePercent[gameType]) / BASIS_POINTS;
        return wagerAmount + edge;
    }

    /**
     * @notice Verifies a game result signature without executing
     * @param gameId The game ID
     * @param winner The winner address
     * @param signature The signature to verify
     * @return True if the signature is valid
     */
    function verifySignature(
        uint256 gameId,
        address winner,
        bytes calldata signature
    ) external view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(GAME_RESULT_TYPEHASH, gameId, winner)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        address recoveredSigner = digest.recover(signature);
        return recoveredSigner == backendSigner && !usedSignatures[digest];
    }
}
