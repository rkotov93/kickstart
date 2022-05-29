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
    mapping (uint => Request) public requests;

    modifier restricted() {
        require(msg.sender == manager, "This method can be called by manager only");
        _;
    }

    constructor(uint minimum, address creator) {
        manager = creator;
        minimumContribution = minimum;
    }

    function contribute() payable public {
        require(msg.value > minimumContribution, "Contribution should be more than minimun value");

        contributors[msg.sender] = true;
        contributorsCount++;
    }

    function createRequest(string memory description, uint value, address payable recipient) public restricted {
        Request storage request = requests[requestsCount++];
        request.description = description;
        request.value = value;
        request.recipient = recipient;
    }

    function approveRequest(uint index) public {
        Request storage request = requests[index];
        require(contributors[msg.sender], "Only contributors can approve requests");
        require(!request.approvers[msg.sender], "This request was already approved by this contributor");

        request.approvers[msg.sender] = true;
        request.approvalsCount++;
    }

    function isRequestApprovedByMe(uint index) public view returns (bool) {
        Request storage request = requests[index];
        return request.approvers[msg.sender];
    }

    function completeRequest(uint index) public restricted {
        require(contributorsCount > 0, "Request cannot be completed without contributors");

        Request storage request = requests[index];
        require(!request.complete, "Request was already complete");
        require(address(this).balance > request.value, "Not enough contributions to complete this request");
        require(request.approvalsCount * 100 / contributorsCount > 65, "At least 65% of contributors should approve the request");

        request.recipient.transfer(request.value);
        request.complete = true;
    }
}
