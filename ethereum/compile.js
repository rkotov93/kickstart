const path = require('path')
const fs = require('fs-extra')
const solc = require('solc')

const buildPath = path.resolve(__dirname, 'build')
fs.removeSync(buildPath)

const campaignPath = path.resolve(__dirname, 'contracts', 'Campaign.sol')
const source = fs.readFileSync(campaignPath, 'utf8')

const input = {
  language: 'Solidity',
  sources: {
    'Campaign.sol': {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*'],
      },
    },
  },
}

const output = JSON.parse(solc.compile(JSON.stringify(input)))
if (output.errors) console.log(output.errors.map(error => error.formattedMessage))
const compiledContracts = output.contracts['Campaign.sol']

for (contract in compiledContracts) {
  fs.outputFileSync(
    path.resolve(buildPath, contract + '.json'),
    JSON.stringify(compiledContracts[contract])
  )
}
