const chai = require('chai');
const { ethers } = require('hardhat');
const {
    utils: { Interface, keccak256 },
} = ethers;
const { expect } = chai;

describe('Multisig', () => {
    let signer1, signer2, signer3;
    let accounts;

    let multisigFactory;
    let multisig;
    let targetFactory;
    let targetContract;
    let calldata;

    before(async () => {
        [signer1, signer2, signer3] = await ethers.getSigners();
        accounts = [signer1, signer2, signer3].map((signer) => signer.address);

        multisigFactory = await ethers.getContractFactory('Multisig', signer1);
        targetFactory = await ethers.getContractFactory('Target', signer1);

        const targetInterface = new Interface(['function callTarget() external']);
        calldata = targetInterface.encodeFunctionData('callTarget');

        multisig = await multisigFactory.deploy(accounts, 2).then((d) => d.deployed());
    });

    beforeEach(async () => {
        // new target contract for each test
        targetContract = await targetFactory.deploy().then((d) => d.deployed());
    });

    it('should initialize the Multisig with signer accounts and threshold', async () => {
        const currentThreshold = 2;

        expect(await multisig.signerThreshold()).to.equal(currentThreshold);
        expect(await multisig.signerAccounts()).to.deep.equal(accounts);
    });

    it('should revert on execute with insufficient value sent', async () => {
        const nativeValue = 100;

        await multisig
            .connect(signer1)
            .executeContract(targetContract.address, calldata, nativeValue)
            .then((tx) => tx.wait());

        await expect(
            multisig.connect(signer2).executeContract(targetContract.address, calldata, nativeValue),
        ).to.be.revertedWithCustomError(multisig, 'InsufficientBalance');
    });

    it('should revert on execute if call to target fails', async () => {
        // Invalid function selector that does not exist on target
        const invalidCalldata = '0x12345678';
        const nativeValue = 100;

        await multisig
            .connect(signer1)
            .executeContract(targetContract.address, invalidCalldata, nativeValue)
            .then((tx) => tx.wait());

        await expect(
            multisig.connect(signer2).executeContract(targetContract.address, invalidCalldata, nativeValue, {
                value: nativeValue,
            }),
        ).to.be.revertedWithCustomError(multisig, 'ExecutionFailed');
    });

    it('should return true if signer has voted on a given topic', async () => {
        const nativeValue = 100;

        const calldataMultiSig = multisig.interface.encodeFunctionData('executeContract', [
            targetContract.address,
            calldata,
            nativeValue,
        ]);
        const calldataMultiSigHash = keccak256(calldataMultiSig);

        await multisig
            .connect(signer1)
            .executeContract(targetContract.address, calldata, nativeValue)
            .then((tx) => tx.wait());

        expect(await multisig.hasSignerVoted(signer1.address, calldataMultiSigHash)).to.equal(true);
    });

    it('should return false if a signer has not voted on a given topic', async () => {
        const nativeValue = 100;

        const calldataMultiSig = multisig.interface.encodeFunctionData('executeContract', [
            targetContract.address,
            calldata,
            nativeValue,
        ]);
        const calldataMultiSigHash = keccak256(calldataMultiSig);

        await multisig
            .connect(signer1)
            .executeContract(targetContract.address, calldata, nativeValue)
            .then((tx) => tx.wait());

        expect(await multisig.hasSignerVoted(signer2.address, calldataMultiSigHash)).to.equal(false);
    });

    it('should return the correct vote count for a given topic', async () => {
        const nativeValue = 10;

        const calldataMultiSig = multisig.interface.encodeFunctionData('executeContract', [
            targetContract.address,
            calldata,
            nativeValue,
        ]);
        const calldataMultiSigHash = keccak256(calldataMultiSig);

        expect(await multisig.getSignerVotesCount(calldataMultiSigHash)).to.equal(0);

        await multisig
            .connect(signer1)
            .executeContract(targetContract.address, calldata, nativeValue)
            .then((tx) => tx.wait());

        expect(await multisig.getSignerVotesCount(calldataMultiSigHash)).to.equal(1);

        await expect(
            multisig.connect(signer2).executeContract(targetContract.address, calldata, nativeValue, {
                value: nativeValue,
            }),
        ).to.emit(targetContract, 'TargetCalled');

        expect(await multisig.getSignerVotesCount(calldataMultiSigHash)).to.equal(0);
    });

    it('should execute function on target contract', async () => {
        const nativeValue = 100;

        await multisig
            .connect(signer1)
            .executeContract(targetContract.address, calldata, nativeValue)
            .then((tx) => tx.wait());

        await expect(
            multisig.connect(signer2).executeContract(targetContract.address, calldata, nativeValue, {
                value: nativeValue,
            }),
        ).to.emit(targetContract, 'TargetCalled');
    });

    it('should execute function on target contract from different participants', async () => {
        const nativeValue = 100;

        for (let i = 0; i < 2; i++) {
            const firstSigner = [signer1, signer2][i];
            const secondSigner = [signer2, signer3][i];

            await multisig
                .connect(firstSigner)
                .executeContract(targetContract.address, calldata, nativeValue)
                .then((tx) => tx.wait());

            await expect(
                multisig.connect(secondSigner).executeContract(targetContract.address, calldata, nativeValue, {
                    value: nativeValue,
                }),
            ).to.emit(targetContract, 'TargetCalled');
        }
    });

    it('should withdraw native value', async () => {
        const recipient = signer3.address;
        const nativeValue = 100;

        await signer1
            .sendTransaction({
                to: multisig.address,
                value: nativeValue,
            })
            .then((tx) => tx.wait());

        await multisig
            .connect(signer1)
            .withdraw(recipient, nativeValue)
            .then((tx) => tx.wait());

        const oldBalance = await ethers.provider.getBalance(recipient);

        await multisig
            .connect(signer2)
            .withdraw(recipient, nativeValue)
            .then((tx) => tx.wait());

        const newBalance = await ethers.provider.getBalance(recipient);
        expect(newBalance).to.equal(oldBalance.add(nativeValue));
    });
});
