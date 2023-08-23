'use strict';

require('dotenv').config();

const {
  Wallet,
  Contract,
  getDefaultProvider,
  utils: { isAddress },
} = require('ethers');

const readlineSync = require('readline-sync');
const { Command, Option } = require('commander');
const {
  isNumber,
  isString,
  loadConfig,
  saveConfig,
  printObj,
} = require('./utils');
const IContractExecutor = require('../interfaces/IContractExecutor.json');

async function getCallData(
  methodName,
  targetContract,
  wallet,
  inputRecipient,
  inputAmount,
) {
  var recipient, amount;

  switch (methodName) {
    case 'withdraw': {
      if (inputRecipient) {
        recipient = inputRecipient;
      } else {
        recipient = readlineSync.question(
          'Enter the recipient address for withdrawal:',
        );
      }

      if (inputAmount) {
        amount = inputAmount;
      } else {
        amount = readlineSync.question(
          'Enter the amount of tokens to withdraw:',
        );
      }

      if (!isAddress(recipient)) {
        throw new Error(
          'Missing or incorrect recipient address for withdrawal from user input.',
        );
      }

      if (!isNumber(amount)) {
        throw new Error(
          'Missing or incorrect withdrawal amount from user input.',
        );
      }

      const IMultisig = require('../interfaces/IMultisig.json'); // This interface contains the withdraw signature
      const multisig = new Contract(targetContract, IMultisig.abi, wallet);
      const callData = multisig.interface.encodeFunctionData('withdraw', [
        recipient,
        amount,
      ]);
      return callData;
    }

    case 'transfer': {
      if (inputRecipient) {
        recipient = inputRecipient;
      } else {
        recipient = readlineSync.question(
          'Enter the recipient address for transfer:',
        );
      }

      if (inputAmount) {
        amount = inputAmount;
      } else {
        amount = readlineSync.question(
          'Enter the amount of tokens to transfer:',
        );
      }

      if (!isAddress(recipient)) {
        throw new Error(
          'Missing or incorrect recipient address for transfer from user input.',
        );
      }

      if (!isNumber(amount)) {
        throw new Error(
          'Missing or incorrect transfer amount from user input.',
        );
      }

      const IERC20 = require('../interfaces/IERC20.json');
      const erc20 = new Contract(targetContract, IERC20.abi, wallet);
      const callData = erc20.interface.encodeFunctionData('transfer', [
        recipient,
        amount,
      ]);
      return callData;
    }

    case 'approve': {
      if (inputRecipient) {
        recipient = inputRecipient;
      } else {
        recipient = readlineSync.question(
          'Enter the recipient address for approval:',
        );
      }

      if (inputAmount) {
        amount = inputAmount;
      } else {
        amount = readlineSync.question(
          'Enter the amount of tokens to approve:',
        );
      }

      if (!isAddress(recipient)) {
        throw new Error(
          'Missing or incorrect recipient address for approval from user input.',
        );
      }

      if (!isNumber(amount)) {
        throw new Error(
          'Missing or incorrect approval amount from user input.',
        );
      }

      const IERC20 = require('../interfaces/IERC20.json');
      const erc20 = new Contract(targetContract, IERC20.abi, wallet);
      const callData = erc20.interface.encodeFunctionData('approve', [
        recipient,
        amount,
      ]);
      return callData;
    }

    default: {
      throw new Error(
        'The method name do not matches with any of the specified choices',
      );
    }
  }
}

async function executeContract(
  contractAddress,
  targetContractAddress,
  wallet,
  inputCallData,
  inputTokenValue,
  methodName,
  recipient,
  amount,
) {
  if (!isAddress(contractAddress)) {
    throw new Error('Missing contract address in the address info.');
  }

  if (!isAddress(targetContractAddress)) {
    throw new Error('Missing target address in the address info.');
  }

  if (!isString(methodName)) {
    throw new Error('Missing method name from the user info.');
  }

  if (!isNumber(inputTokenValue)) {
    throw new Error('Missing token value from user info');
  }

  const contract = new Contract(contractAddress, IContractExecutor.abi, wallet);
  var callData, tokenValue;

  if (methodName === 'default') {
    callData = inputCallData;
    tokenValue = inputTokenValue;
  } else {
    callData = getCallData(
      methodName,
      targetContractAddress,
      wallet,
      recipient,
      amount,
    );
    tokenValue = Number(0);
  }

  (async () => {
    try {
      const result = await contract.executeContract(
        targetContractAddress,
        callData,
        tokenValue,
      );
      console.log('Function successfully called with return value as: ');
      printObj(result);
    } catch (error) {
      console.log('Calling executeContract method failed with Error: ');
      printObj(error);
    }
  })();
}

async function main(options) {
  const config = loadConfig(options.env);
  let chains = options.chainNames.split(',').map((str) => str.trim());

  if (options.chainNames === 'all') {
    chains = Object.keys(config.chains);
  }

  for (const chain of chains) {
    if (config.chains[chain.toLowerCase()] === undefined) {
      throw new Error(`Chain ${chain} is not defined in the info file`);
    }
  }

  for (const chain of chains) {
    const rpc = chain.rpc;
    const provider = getDefaultProvider(rpc);
    const privateKey = options.privateKey;

    if (!isString(privateKey)) {
      throw new Error('Private Key value is not provided in the info file');
    }

    const wallet = new Wallet(privateKey, provider);
    await executeContract(
      options.callContractAddress,
      options.targetAddress,
      wallet,
      options.callData,
      Number(options.nativeValue),
      options.methodName,
      options.recipientAddress,
      options.amount,
    );
    saveConfig(config, options.env);
  }
}

const program = new Command();

program
  .name('execute-contract')
  .description('Executes a call to an external contract');

program.addOption(
  new Option('-e, --env <env>', 'environment')
    .choices(['local', 'devnet', 'stagenet', 'testnet', 'mainnet'])
    .default('testnet')
    .makeOptionMandatory(true)
    .env('ENV'),
);
program.addOption(
  new Option(
    '-n, --chainNames <chainNames>',
    'chain names',
  ).makeOptionMandatory(true),
);
program.addOption(
  new Option(
    '-a, --callContractAddress <contractAddress>',
    'The contract address in which we will call executeContract function',
  )
    .makeOptionMandatory(true)
    .env('CONTRACT_ADDR'),
);
program.addOption(
  new Option(
    '-t, --targetAddress <targetAddress>',
    'The address of the contract to be called',
  )
    .makeOptionMandatory(true)
    .env('TARGET_ADDR'),
);
program.addOption(
  new Option(
    '-v, --nativeValue <nativeValue>',
    'The amount of native token (e.g., Ether) to be sent along with the call',
  )
    .default(0)
    .env('NATIVE_VALUE'),
);
program.addOption(
  new Option(
    '-m, --methodName <methodName>',
    'method name to call in executeContract',
  )
    .choices(['withdraw', 'transfer', 'approve', 'default'])
    .default('default')
    .env('METHOD_NAME'),
);
program.addOption(
  new Option('-p, --privateKey <privateKey>', 'The private key of the caller')
    .makeOptionMandatory(true)
    .env('PRIVATE_KEY'),
);
program.addOption(
  new Option('-c, --callData <callData>', 'The calldata to be sent')
    .env('CALL_DATA')
    .default('0x'),
);
program.addOption(
  new Option(
    '-ra, --recipientAddress <recipientAddress>',
    'The recipient address for the tokens',
  ).env('RECIPIENT_ADDR'),
);
program.addOption(
  new Option(
    '-am, --amount <amount>',
    'The amount of tokens to transfer/withdraw/provide allowance etc.',
  ).env('AMOUNT'),
);

program.action((options) => {
  main(options);
});

program.parse();
