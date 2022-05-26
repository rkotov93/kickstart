const chai = require('chai')
const { expect, assert } = chai
chai.use(require('chai-as-promised'))
const ganache = require('ganache-cli')
const Web3 = require('web3')
const web3 = new Web3(ganache.provider())

const campaignContract = require('../../ethereum/build/Campaign.json')

const VM_EXCEPTION_MESSAGE = 'VM Exception while processing transaction: revert'

describe('Campaign Contract', () => {
  let accounts
  let campaign

  const contribute = async (sender, value) => {
    await campaign.methods.contribute().send({ from: sender, value: value })
  }

  const createRequest = async (sender, to, amount = 50) => {
    await campaign.methods
      .createRequest('description', amount, to)
      .send({ from: sender, gas: '3000000' })
  }

  const approveRequest = async (sender) => {
    await campaign.methods.approveRequest(0).send({ from: sender, gas: '3000000' })
  }

  const completeRequest = async (sender) => {
    await campaign.methods.completeRequest(0).send({ from: sender, gas: '3000000' })
  }

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    campaign = await new web3.eth.Contract(campaignContract.abi)
      .deploy({
        data: campaignContract.evm.bytecode.object,
        arguments: ['100', accounts[0]]
      }).send({ from: accounts[0], gas: '3000000' })
  })

  it ('deployes the contract', async () => {
    assert.ok(campaign.options.address)

    const manager = await campaign.methods.manager().call()
    assert.equal(manager, accounts[0])
  })

  describe('#contribute', () => {
    context('when value is more than minimum contribution', () => {
      it('adds account as a new contributor', async () => {
        await contribute(accounts[1], '101')

        isContributor = await campaign.methods.contributors(accounts[1]).call()
        assert.ok(isContributor)
      })
    })

    context('when value is less than minimum contribution', () => {
      it('raises an error', async () => {
        await expect(contribute(accounts[1], '99'))
          .to.be.rejectedWith(Error, VM_EXCEPTION_MESSAGE)
      })
    })
  })

  describe('#createRequest', () => {
    context('when sender is not a manager', () => {
      it('raises an error', async () => {
        await expect(createRequest(accounts[1], accounts[2]))
          .to.be.rejectedWith(Error, VM_EXCEPTION_MESSAGE)
      })
    })

    context('when sender is a manager', () => {
      it('creates a request', async () => {
        await createRequest(accounts[0], accounts[2])

        const request = await campaign.methods.requests(0).call()
        assert.equal(request.description, 'description')
        assert.equal(request.value, '50')
        assert.equal(request.recipient, accounts[2])
        assert.equal(request.complete, false)
        assert.equal(request.approvalsCount, 0)
      })
    })
  })

  describe('#approveRequest', () => {
    beforeEach(async () => {
      await contribute(accounts[1], '101')
      await createRequest(accounts[0], accounts[2])
    })

    context('when approver is not a contributor', () => {
      it('raises an error', async () => {
        await expect(approveRequest(accounts[3]))
          .to.be.rejectedWith(Error, VM_EXCEPTION_MESSAGE)
      })
    })

    context('when approver is a contributor', () => {
      beforeEach(async () => {
        await approveRequest(accounts[1])
      })

      context('when request was already approved by approver', () => {
        it('raises an error', async () => {
          await expect(approveRequest(accounts[1]))
            .to.be.rejectedWith(Error, VM_EXCEPTION_MESSAGE)
        })
      })

      it('approves the request', async () => {
        const request = await campaign.methods.requests(0).call()
        assert.equal(request.approvalsCount, 1)
        assert.ok(await campaign.methods.isRequestApprovedByMe(0).call({ from: accounts[1] }))
      })
    })
  })

  describe('#completeRequest', () => {
    beforeEach(async () => {
      await createRequest(accounts[0], accounts[1], web3.utils.toWei('1', 'ether'))
    })

    context('when sender is not a manager', () => {
      it('raises an error', async () => {
        expect(completeRequest(accounts[1]))
          .to.be.rejectedWith(Error, VM_EXCEPTION_MESSAGE)
      })
    })

    context('when there are no contributors', () => {
      it('raises an error', async () => {
        await expect(completeRequest(accounts[0]))
          .to.be.rejectedWith(Error, VM_EXCEPTION_MESSAGE)
      })
    })

    context('when request was already complete', () => {
      beforeEach(async () => {
        await contribute(accounts[2], web3.utils.toWei('2', 'ether'))
        await approveRequest(accounts[2])
        await completeRequest(accounts[0])
      })

      it('raises an error', async () => {
        await expect(completeRequest(accounts[0]))
          .to.be.rejectedWith(Error, VM_EXCEPTION_MESSAGE)
      })
    })

    context('when less than 65% of contributors approved request', () => {
      beforeEach(async () => {
        await contribute(accounts[2], web3.utils.toWei('1', 'ether'))
        await contribute(accounts[3], web3.utils.toWei('1', 'ether'))
        await approveRequest(accounts[2])
      })

      it('raises an error', async () => {
        await expect(completeRequest(accounts[0]))
          .to.be.rejectedWith(Error, VM_EXCEPTION_MESSAGE)
      })
    })

    context('when more than 65% of contributors approved request', () => {
      let initialRecipientBalance

      beforeEach(async () => {
        initialRecipientBalance = web3.utils.fromWei(await web3.eth.getBalance(accounts[1]), 'ether')
        const amount = web3.utils.toWei('1', 'ether')
        await contribute(accounts[2], amount)
        await contribute(accounts[3], amount)
        await contribute(accounts[4], amount)
        await approveRequest(accounts[2])
        await approveRequest(accounts[3])
      })

      it('transfers money to recipient', async () => {
        await completeRequest(accounts[0])
        const request = await campaign.methods.requests(0).call()
        assert.ok(request.complete)

        const currentRecipientBalance = web3.utils.fromWei(await web3.eth.getBalance(accounts[1]), 'ether')
        assert.equal(currentRecipientBalance - initialRecipientBalance, 1)
      })
    })
  })
})
