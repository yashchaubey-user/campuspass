// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CampusEvents - organizers list college events, students buy tickets with ETH
/// @notice Listing metadata (title, description, poster) lives in a SQL database;
///         the blockchain stores only the sha-256 hash of that metadata, ticket sales
///         and direct ETH payments to organizers.
contract CampusEvents {
    struct EventInfo {
        uint256 id;
        address organizer;
        bytes32 metadataHash;   // sha-256 hash of title/description/poster stored in SQL
        uint256 price;          // ticket price in wei
        uint256 maxTickets;
        uint256 sold;
        uint256 eventDate;      // unix timestamp
        bool    active;
    }

    /// @notice Minimum ticket price an organizer can set (0.0001 ETH)
    uint256 public constant MIN_PRICE = 0.0001 ether;

    uint256 public eventCount;
    mapping(uint256 => EventInfo)                   private events;
    mapping(uint256 => mapping(address => bool))    public  hasTicket;
    mapping(uint256 => address[])                   private attendees;

    event EventCreated(uint256 indexed id, address indexed organizer, bytes32 metadataHash, uint256 price);
    event TicketBought(uint256 indexed id, address indexed buyer, uint256 price);
    event EventCancelled(uint256 indexed id);

    /// @notice Publish a new campus event
    /// @param metadataHash SHA-256 hash returned by the SQL server after saving listing data
    /// @param price        Ticket price in wei (>= MIN_PRICE)
    /// @param maxTickets   Total tickets available (> 0)
    /// @param eventDate    Unix timestamp of the event (must be in the future)
    function createEvent(
        bytes32 metadataHash,
        uint256 price,
        uint256 maxTickets,
        uint256 eventDate
    ) external returns (uint256 id) {
        require(metadataHash != bytes32(0), "Metadata required");
        require(price >= MIN_PRICE,         "Min ticket price is 0.0001 ETH");
        require(maxTickets > 0,             "Need at least 1 ticket");
        require(eventDate > block.timestamp,"Date must be in future");

        id = ++eventCount;
        events[id] = EventInfo(
            id, msg.sender, metadataHash,
            price, maxTickets, 0, eventDate, true
        );
        emit EventCreated(id, msg.sender, metadataHash, price);
    }

    /// @notice Purchase one ticket for the given event
    /// @dev    Checks-Effects-Interactions: state is updated BEFORE the ETH transfer
    ///         so a re-entrant call from a malicious organizer contract would revert
    ///         on the "Already have a ticket" or "Sold out" check.
    function buyTicket(uint256 id) external payable {
        EventInfo storage e = events[id];
        require(e.id != 0,                     "No such event");
        require(e.active,                      "Event cancelled");
        require(block.timestamp < e.eventDate, "Event already happened");
        require(e.sold < e.maxTickets,         "Sold out");
        require(!hasTicket[id][msg.sender],    "Already have a ticket");
        require(msg.value == e.price,          "Send exact price");

        // --- effects first (reentrancy protection) ---
        e.sold += 1;
        hasTicket[id][msg.sender] = true;
        attendees[id].push(msg.sender);

        // --- interaction: pay organizer directly ---
        (bool ok, ) = payable(e.organizer).call{value: msg.value}("");
        require(ok, "Payment failed");

        emit TicketBought(id, msg.sender, msg.value);
    }

    /// @notice Organizer stops further ticket sales
    function cancelEvent(uint256 id) external {
        EventInfo storage e = events[id];
        require(msg.sender == e.organizer, "Not organizer");
        require(e.active,                  "Already cancelled");
        e.active = false;
        emit EventCancelled(id);
    }

    // ── view helpers ──────────────────────────────────────────────────────

    function getEvent(uint256 id) external view returns (EventInfo memory) {
        require(events[id].id != 0, "No such event");
        return events[id];
    }

    function getAttendees(uint256 id) external view returns (address[] memory) {
        return attendees[id];
    }

    /// @notice IDs of events the given wallet holds tickets for
    function getMyTickets(address user) external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 1; i <= eventCount; i++)
            if (hasTicket[i][user]) count++;
        uint256[] memory out = new uint256[](count);
        uint256 j;
        for (uint256 i = 1; i <= eventCount; i++)
            if (hasTicket[i][user]) out[j++] = i;
        return out;
    }
}

