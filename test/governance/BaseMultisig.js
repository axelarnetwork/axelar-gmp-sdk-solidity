const chai = require('chai');
const { ethers } = require('hardhat');
const {
  utils: { keccak256 },
  constants: { AddressZero },
  Wallet,
} = ethers;
const { expect } = chai;

describe('BaseMultisig', () => {
  let signer1, signer2, signer3, nonSigner;
  let initAccounts;
  let rotatedAccounts;
  let threshold;

  let multisigFactory;
  let multisig;

  before(async () => {
    threshold = 2;
    [signer1, signer2, nonSigner] = await ethers.getSigners();
    signer3 = Wallet.createRandom().connect(ethers.provider);

    initAccounts = [signer1, signer2, signer3].map((signer) => signer.address);
    rotatedAccounts = [signer2, signer3, nonSigner].map(
      (signer) => signer.address,
    );

    multisigFactory = await ethers.getContractFactory(
      'TestBaseMultisig',
      signer1,
    );
  });

  describe('queries', () => {
    before(async () => {
      multisig = await multisigFactory
        .deploy(initAccounts, threshold)
        .then((d) => d.deployed());
    });

    it('should return the current epoch', async () => {
      const currentEpoch = 1;
      const returnedEpoch = await multisig.signerEpoch();

      expect(currentEpoch).to.equal(returnedEpoch);
    });

    it('should return the signer threshold for a given epoch', async () => {
      expect(await multisig.signerThreshold()).to.equal(threshold);
    });

    it('should return true if an account is a signer', async () => {
      expect(await multisig.isSigner(signer1.address)).to.equal(true);
      expect(await multisig.isSigner(signer2.address)).to.equal(true);
      expect(await multisig.isSigner(signer3.address)).to.equal(true);
    });

    it('should return false if an account is not a signer', async () => {
      expect(await multisig.isSigner(nonSigner.address)).to.equal(false);
    });

    it('should return the array of signers for a given epoch', async () => {
      expect(await multisig.signerAccounts()).to.deep.equal(initAccounts);
    });
  });

  describe('negative tests', () => {
    before(async () => {
      multisig = await multisigFactory
        .deploy(initAccounts, threshold)
        .then((d) => d.deployed());
    });

    it('should revert if non-signer calls only signers function', async () => {
      const newThreshold = 2;

      await expect(
        multisig
          .connect(nonSigner)
          .rotateSigners(rotatedAccounts, newThreshold),
      ).to.be.revertedWithCustomError(multisig, 'NotSigner');
    });

    it('should not proceed with operation execution with insufficient votes', async () => {
      const newThreshold = 2;

      const tx = await multisig
        .connect(signer1)
        .rotateSigners(rotatedAccounts, newThreshold);

      await expect(tx).to.not.emit(multisig, 'MultisigOperationExecuted');
    });

    it('should revert if signer tries to vote twice', async () => {
      const newThreshold = 1;

      await multisig
        .connect(signer1)
        .rotateSigners(rotatedAccounts, newThreshold)
        .then((tx) => tx.wait());

      await expect(
        multisig.connect(signer1).rotateSigners(rotatedAccounts, newThreshold),
      ).to.be.revertedWithCustomError(multisig, 'AlreadyVoted');
    });

    it('should revert on rotate signers if new threshold is too large', async () => {
      const newThreshold = 4;

      await multisig
        .connect(signer1)
        .rotateSigners(rotatedAccounts, newThreshold)
        .then((tx) => tx.wait());

      await expect(
        multisig.connect(signer2).rotateSigners(rotatedAccounts, newThreshold),
      ).to.be.revertedWithCustomError(multisig, 'InvalidSigners');
    });

    it('should revert on rotate signers if new threshold is zero', async () => {
      const newThreshold = 0;

      await multisig
        .connect(signer1)
        .rotateSigners(rotatedAccounts, newThreshold)
        .then((tx) => tx.wait());

      await expect(
        multisig.connect(signer2).rotateSigners(rotatedAccounts, newThreshold),
      ).to.be.revertedWithCustomError(multisig, 'InvalidSignerThreshold');
    });

    it('should revert on rotate signers with any duplicate signers', async () => {
      const newThreshold = 2;

      const rotatedAccountsWithDuplicate = rotatedAccounts.concat(
        rotatedAccounts[0],
      );

      await multisig
        .connect(signer1)
        .rotateSigners(rotatedAccountsWithDuplicate, newThreshold)
        .then((tx) => tx.wait());

      await expect(
        multisig
          .connect(signer2)
          .rotateSigners(rotatedAccountsWithDuplicate, newThreshold),
      ).to.be.revertedWithCustomError(multisig, 'DuplicateSigner');
    });

    it('should revert on rotate signers with any invalid signer addresses', async () => {
      const newThreshold = 2;

      const rotatedAccountsInvalid = rotatedAccounts.concat(AddressZero);

      await multisig
        .connect(signer1)
        .rotateSigners(rotatedAccountsInvalid, newThreshold)
        .then((tx) => tx.wait());

      await expect(
        multisig
          .connect(signer2)
          .rotateSigners(rotatedAccountsInvalid, newThreshold),
      ).to.be.revertedWithCustomError(multisig, 'InvalidSigners');
    });
  });

  describe('positive tests', () => {
    beforeEach(async () => {
      multisig = await multisigFactory
        .deploy(initAccounts, threshold)
        .then((d) => d.deployed());
    });

    it('should proceed with operation execution with sufficient votes', async () => {
      const newThreshold = 2;

      const msgData = multisig.interface.encodeFunctionData('rotateSigners', [
        rotatedAccounts,
        newThreshold,
      ]);
      const msgDataHash = keccak256(msgData);

      await expect(
        await multisig
          .connect(signer1)
          .rotateSigners(rotatedAccounts, newThreshold),
      )
        .to.emit(multisig, 'MultisigVoted')
        .withArgs(msgDataHash, 1, signer1.address, 1, 2);

      await expect(
        multisig.connect(signer2).rotateSigners(rotatedAccounts, newThreshold),
      )
        .to.emit(multisig, 'MultisigOperationExecuted')
        .withArgs(msgDataHash, 1, signer2.address, 2);
    });

    it('should reset the votes internally', async () => {
      const newThreshold = 2;

      const msgData = multisig.interface.encodeFunctionData('rotateSigners', [
        rotatedAccounts,
        newThreshold,
      ]);
      const msgDataHash = keccak256(msgData);

      expect(await multisig.getSignerVotesCount(msgDataHash)).to.equal(0);
      expect(
        await multisig.hasSignerVoted(signer1.address, msgDataHash),
      ).to.equal(false);

      await multisig
        .connect(signer1)
        .rotateSigners(rotatedAccounts, newThreshold)
        .then((tx) => tx.wait());

      expect(await multisig.getSignerVotesCount(msgDataHash)).to.equal(1);
      expect(
        await multisig.hasSignerVoted(signer1.address, msgDataHash),
      ).to.equal(true);

      await multisig.resetVotes(msgDataHash).then((tx) => tx.wait());

      expect(await multisig.getSignerVotesCount(msgDataHash)).to.equal(0);
      expect(
        await multisig.hasSignerVoted(signer1.address, msgDataHash),
      ).to.equal(false);

      await expect(
        await multisig
          .connect(signer1)
          .rotateSigners(rotatedAccounts, newThreshold),
      )
        .to.emit(multisig, 'MultisigVoted')
        .withArgs(msgDataHash, 1, signer1.address, 1, 2);

      await expect(
        await multisig
          .connect(signer2)
          .rotateSigners(rotatedAccounts, newThreshold),
      )
        .to.emit(multisig, 'MultisigOperationExecuted')
        .withArgs(msgDataHash, 1, signer2.address, 2);
    });

    it('should proceed with signer rotation with sufficient votes and valid arguments', async () => {
      const newThreshold = 2;

      const msgData = multisig.interface.encodeFunctionData('rotateSigners', [
        rotatedAccounts,
        newThreshold,
      ]);
      const msgDataHash = keccak256(msgData);

      await expect(
        await multisig
          .connect(signer1)
          .rotateSigners(rotatedAccounts, newThreshold),
      )
        .to.emit(multisig, 'MultisigVoted')
        .withArgs(msgDataHash, 1, signer1.address, 1, 2);

      await expect(
        multisig.connect(signer2).rotateSigners(rotatedAccounts, newThreshold),
      )
        .to.emit(multisig, 'MultisigOperationExecuted')
        .withArgs(msgDataHash, 1, signer2.address, 2)
        .and.to.emit(multisig, 'SignersRotated')
        .withArgs(rotatedAccounts, newThreshold);

      expect(await multisig.signerThreshold()).to.equal(newThreshold);
      expect(await multisig.signerAccounts()).to.deep.equal(rotatedAccounts);

      for (const signer of rotatedAccounts) {
        expect(await multisig.isSigner(signer)).to.equal(true);
      }

      expect(await multisig.isSigner(signer1.address)).to.equal(false);
    });
  });
});
