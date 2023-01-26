'use strict';

const {
  Contract,
  ContractFactory,
  utils: { keccak256 },
} = require('ethers');
const { deployAndInitContractConstant } = require('./constAddressDeployer');

const IUpgradable = require('../dist/IUpgradable.json');

async function deployUpgradable(
  constAddressDeployerAddress,
  wallet,
  implementationJson,
  proxyJson,
  implementationConstructorArgs = [],
  proxyConstructorArgs = [],
  setupParams = '0x',
  key = Date.now(),
  gasLimit = null,
) {
  const implementationFactory = new ContractFactory(
    implementationJson.abi,
    implementationJson.bytecode,
    wallet,
  );

  const implementation = await implementationFactory.deploy(
    ...implementationConstructorArgs,
  );
  await implementation.deployed();

  const proxy = await deployAndInitContractConstant(
    constAddressDeployerAddress,
    wallet,
    proxyJson,
    key,
    proxyConstructorArgs,
    [implementation.address, wallet.address, setupParams],
    gasLimit,
  );

  return new Contract(proxy.address, implementationJson.abi, wallet);
}

async function upgradeUpgradable(
  proxyAddress,
  wallet,
  contractJson,
  implementationConstructorArgs = [],
  setupParams = '0x',
) {
  const proxy = new Contract(proxyAddress, IUpgradable.abi, wallet);

  const implementationFactory = new ContractFactory(
    contractJson.abi,
    contractJson.bytecode,
    wallet,
  );

  const implementation = await implementationFactory.deploy(
    ...implementationConstructorArgs,
  );
  await implementation.deployed();

  const implementationCode = await wallet.provider.getCode(
    implementation.address,
  );
  const implementationCodeHash = keccak256(implementationCode);

  const tx = await proxy.upgrade(
    implementation.address,
    implementationCodeHash,
    setupParams,
  );
  await tx.wait();
  return tx;
}

module.exports = {
  deployUpgradable,
  upgradeUpgradable,
};
