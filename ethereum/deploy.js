require('dotenv').config()
const HDWalletProvider = require('@truffle/hdwallet-provider');
const Web3 = require('web3');
const compiledCampaignFactory = require('./build/CampaignFactory.json');

const provider = new HDWalletProvider(process.env.SEED_PHRASE, process.env.INFURA_URL);

const web3 = new Web3(provider);

const deploy = async () => {
  const accounts = await web3.eth.getAccounts();

  console.log('Attempting to deploy from account', accounts[0]);

  const result = await new web3.eth.Contract(compiledCampaignFactory.abi)
    .deploy({ data: compiledCampaignFactory.evm.bytecode.object })
    .send({ gas: '3000000', from: accounts[0] });

  console.log(JSON.stringify(compiledCampaignFactory.abi));
  console.log('Contract deployed to', result.options.address);
  provider.engine.stop();
};
deploy();
