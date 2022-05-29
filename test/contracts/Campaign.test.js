const chai = require('chai')
const { assert } = chai
chai.use(require('chai-as-promised'))
const ganache = require('ganache')
const Web3 = require('web3')
const web3 = new Web3(ganache.provider({
  logging: {
    logger: {
      log: () => {} // don't do anything
    }
  }
}))

const campaignContract = require('../../ethereum/build/Campaign.json')

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
    web3.eth.handleRevert = true
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
        try {
          await contribute(accounts[1], '99')
          assert.ok(false)
        } catch (error) {
          assert.equal(error.reason, 'Contribution should be more than minimun value')
        }
      })
    })
  })

  describe('#createRequest', () => {
    context('when sender is not a manager', () => {
      it('raises an error', async () => {
        try {
          await createRequest(accounts[1], accounts[2])
          assert.ok(false)
        } catch (error) {
          assert.equal(error.reason, 'This method can be called by manager only')
        }
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
        try {
          await approveRequest(accounts[3])
          assert.ok(false)
        } catch (error) {
          assert.equal(error.reason, 'Only contributors can approve requests')
        }
      })
    })

    context('when approver is a contributor', () => {
      beforeEach(async () => {
        await approveRequest(accounts[1])
      })

      context('when request was already approved by approver', () => {
        it('raises an error', async () => {
          try {
            await approveRequest(accounts[1])
            assert.ok(false)
          } catch (error) {
            assert.equal(error.reason, 'This request was already approved by this contributor')
          }
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
        try {
          await completeRequest(accounts[1])
          assert.ok(false)
        } catch (error) {
          assert.equal(error.reason, 'This method can be called by manager only')
        }
      })
    })

    context('when there are no contributors', () => {
      it('raises an error', async () => {
        try {
          await completeRequest(accounts[0])
          assert.ok(false)
        } catch (error) {
          assert(error.reason, 'Request cannot be completed without contributors')
        }
      })
    })

    context("when contract's balance is less than request value", () => {
      beforeEach(async () => {
        await contribute(accounts[2], web3.utils.toWei('500', 'Finney'))
        await approveRequest(accounts[2])
      })

      it('raises an error', async () => {
        try {
          await completeRequest(accounts[0])
          assert.ok(false)
        } catch (error) {
          assert.equal(error.reason, 'Not enough contributions to complete this request')
        }
      })
    })

    context('when request was already complete', () => {
      beforeEach(async () => {
        await contribute(accounts[2], web3.utils.toWei('2', 'ether'))
        await approveRequest(accounts[2])
        await completeRequest(accounts[0])
      })

      it('raises an error', async () => {
        try {
          await completeRequest(accounts[0])
          assert.ok(false)
        } catch (error) {
          assert.equal(error.reason, 'Request was already complete')
        }
      })
    })

    context('when less than 65% of contributors approved request', () => {
      beforeEach(async () => {
        await contribute(accounts[2], web3.utils.toWei('1', 'ether'))
        await contribute(accounts[3], web3.utils.toWei('1', 'ether'))
        await approveRequest(accounts[2])
      })

      it('raises an error', async () => {
        try {
          await completeRequest(accounts[0])
          assert.ok(false)
        } catch (error) {
          assert.equal(error.reason, 'At least 65% of contributors should approve the request')
        }
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
