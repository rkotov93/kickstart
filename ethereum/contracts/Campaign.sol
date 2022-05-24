pragma solidity ^0.8.14;

contract CampaignFactory {
    Campaign[] public campaigns;

    function createCampaign(uint minimum) public {
        Campaign newCampaign = new Campaign(minimum, msg.sender);
        campaigns.push(newCampaign);
    }

    function getDeployedContracts() public view returns (Campaign[] memory) {
        return campaigns;
    }
}

contract Campaign {
    struct Request {
        string description;
        uint value;
        address payable recipient;
        bool complete;
        uint approvalsCount;
        mapping(address => bool) approvers;
    }

    address public manager;
    uint public minimumContribution;
    uint contributorsCount;
    mapping(address => bool) public contributors;
    uint requestsCount;
    mapping (uint => Request) requests;

    modifier restricted() {
        require(msg.sender == manager);
        _;
    }

    constructor(uint minimum, address creator) {
        manager = creator;
        minimumContribution = minimum;
    }

    function contribute() payable public {
        require(msg.value > minimumContribution);

        contributors[msg.sender] = true;
        contributorsCount++;
    }

    function createRequest(string memory description, uint value, address payable recipient) public restricted {
        Request storage request = requests[requestsCount++];
        request.description = description;
        request.value = value;
        request.recipient = recipient;
        request.complete = false;
        request.approvalsCount = 0;
    }

    function approveRequest(uint index) public {
        Request storage request = requests[index];
        require(contributors[msg.sender] && !request.approvers[msg.sender]);

        request.approvers[msg.sender] = true;
        request.approvalsCount++;
    }

    function completeRequest(uint index) public restricted {
        Request storage request = requests[index];
        require(!request.complete);
        require(request.approvalsCount * 100 / contributorsCount > 65);

        request.recipient.transfer(request.value);
        request.complete = true;
    }
}
