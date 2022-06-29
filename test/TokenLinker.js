'use strict';

const chai = require('chai');
const {
  Contract,
  utils: { defaultAbiCoder, keccak256, id },
} = require('ethers');
const { deployContract, MockProvider, solidity } = require('ethereum-waffle');
const { deployAndInitContractConstant } = require('../index.js');
chai.use(solidity);
const { expect } = chai;

const AxelarGateway = require('../build/MockGateway.json');
const BurnableMintableCappedERC20 = require('../build/BurnableMintableCappedERC20.json');
const ConstAddressDeployer = require('../build/ConstAddressDeployer.json');

const getRandomID = () => id(Math.floor(Math.random() * 1e10).toString());

const LOCK_UNLOCK = 0;
const MINT_BURN = 1;
const NATIVE = 2;

describe('GeneralMessagePassing', () => {
  const [
    ownerWallet,
    operatorWallet,
    userWallet,
    adminWallet1,
    adminWallet2,
    adminWallet3,
    adminWallet4,
    adminWallet5,
    adminWallet6,
  ] = new MockProvider().getWallets();
  const adminWallets = [
    adminWallet1,
    adminWallet2,
    adminWallet3,
    adminWallet4,
    adminWallet5,
    adminWallet6,
  ];
  const threshold = 3;

  let gateway;
  let tokenLinker;
  let token;

  const deployTokenLinker = async (tokenType) => {
    tokenLinker = await deployAndInitContractConstant(
      constAddressDeployer.address,
      ownerWallet,
      TokenLinkerImplementation,
      'token-linker',
      [],
      [gateway.address, tokenType, token.address],
    );
  };
  const sourceChain = 'chainA';
  const destinationChain = 'chainB';
  const tokenName = 'testToken';
  const tokenSymbol = 'TEST';
  const decimals = 16;
  const capacity = 0;

  beforeEach(async () => {
    gateway = await deployContract(ownerWallet, AxelarGateway);
    const constAddressDeployer = await deployContract(
      ownerWallet,
      ConstAddressDeployer,
    );

    token = await deployContract(ownerWallet, BurnableMintableCappedERC20, [
      tokenName,
      tokenSymbol,
      decimals,
      capacity,
    ]);

    describe('lock unlock', () => {
      beforeEach(async () => {
        await deployTokenLinker(LOCK_UNLOCK);
      });
      it('should lock token', async () => {
        const amount = 1e6;
        await token.connect(userWallet).mint(amount);
        await token.connect(userWallet).approve(tokenLinker.address, amount);
        expect(tokenLinker.connect(userWallet).sendToken('destination', userWallet.address, amount))
            .to.emmit(token, 'Transfer')
      });
    });
  });
});
