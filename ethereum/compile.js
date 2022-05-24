// const path = require('path')
// const fs = require('fs')
// const solc = require('solc')

// const lotteryPath = path.resolve(__dirname, 'contracts', 'Lottery.sol')
// const source = fs.readFileSync(lotteryPath, 'utf8')

// const input = {
//   language: 'Solidity',
//   sources: {
//     'Lottery.sol': {
//       content: source,
//     },
//   },
//   settings: {
//     outputSelection: {
//       '*': {
//         '*': ['*'],
//       },
//     },
//   },
// }

// module.exports = JSON.parse(solc.compile(JSON.stringify(input))).contracts[
//   'Lottery.sol'
// ].Lottery

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
const compiledContracts = output.contracts['Campaign.sol']

for (contract in compiledContracts) {
  fs.outputFileSync(
    path.resolve(buildPath, contract + '.json'),
    JSON.stringify(compiledContracts[contract])
  )
}

