const assert = require('assert')
const ganache = require('ganache-cli')
const Web3 = require('web3')
const web3 = new Web3(ganache.provider())


describe('CampaignFactory Contract', () => {
  const campaignFactoryContract = require('../../ethereum/build/CampaignFactory.json')
  const campaignContract = require('../../ethereum/build/Campaign.json')

  let accounts
  let factory
  let campaignAddress
  let campaign

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    factory = await new web3.eth.Contract(campaignFactoryContract.abi)
      .deploy({ data: campaignFactoryContract.evm.bytecode.object })
      .send({ from: accounts[0], gas: '3000000' })
  })

  describe('#createCampaign', () => {
    beforeEach(async () => {
      await factory.methods.createCampaign('100').send({
        from: accounts[0],
        gas: '3000000'
      })
      ;[campaignAddress] = await factory.methods.getDeployedContracts().call()
      campaign = await new web3.eth.Contract(
        campaignContract.abi,
        campaignAddress
      )
    })

    it('deployes a factory and campaign contracts', async () => {
      assert.ok(factory.options.address)
      assert.ok(campaign.options.address)

      const manager = await campaign.methods.manager().call()
      assert.equal(manager, accounts[0])
    })
  })
})
