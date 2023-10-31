'use strict';

const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');
const {
  constants: { AddressZero },
} = require('ethers');
const { expectRevert } = require('../utils');

function toAccountRoles(roles) {
  let accountRoles = 0;

  for (const role of roles) {
    accountRoles |= 1 << role;
  }

  return accountRoles;
}

describe('Roles', () => {
  let testRolesFactory;
  let testRoles;

  let ownerWallet;
  let userWallet;

  let accounts;
  let roleSets;

  before(async () => {
    [ownerWallet, userWallet] = await ethers.getSigners();

    testRolesFactory = await ethers.getContractFactory(
      'TestRoles',
      ownerWallet,
    );
  });

  describe('negative tests', () => {
    beforeEach(async () => {
      accounts = [ownerWallet.address];
      roleSets = [[1, 2, 3]];

      testRoles = await testRolesFactory
        .deploy(accounts, roleSets)
        .then((d) => d.deployed());
    });

    it('should revert on deployment with invalid roles length', async () => {
      accounts.push(userWallet.address);

      await expectRevert(
        (gasOptions) => testRolesFactory.deploy(accounts, roleSets, gasOptions),
        testRoles,
        'InvalidRolesLength',
      );

      accounts.pop();
    });

    it('should revert when non-role account calls onlyRole function', async () => {
      const num = 5;
      const role = 1;

      await expectRevert(
        (gasOptions) =>
          testRoles.connect(userWallet).setNum(num, role, gasOptions),
        testRoles,
        'MissingRole',
        {
          account: userWallet.address,
          role,
        },
      );
    });

    it('should not revert when role account calls onlyRole function', async () => {
      const num = 5;
      const role = 1;

      await expect(testRoles.connect(ownerWallet).setNum(num, role))
        .to.emit(testRoles, 'NumSet')
        .withArgs(num);
    });

    it('should revert when non-role account calls withAllTheRoles function', async () => {
      const num = 5;
      const roles = [1, 2, 3];

      await expectRevert(
        (gasOptions) =>
          testRoles
            .connect(userWallet)
            .setNumWithAllRoles(num, roles, gasOptions),
        testRoles,
        'MissingAllRoles',
        {
          account: userWallet.address,
          roles,
        },
      );
    });

    it('should not revert when role account calls withAllTheRoles function', async () => {
      const num = 5;
      const roles = [1, 2, 3];

      await expect(
        testRoles.connect(ownerWallet).setNumWithAllRoles(num, roles),
      )
        .to.emit(testRoles, 'NumSet')
        .withArgs(num);
    });

    it('should revert when non-role account calls withAnyOfRoles function', async () => {
      const num = 5;
      const roles = [1, 2, 3];

      await expectRevert(
        (gasOptions) =>
          testRoles
            .connect(userWallet)
            .setNumWithAnyRoles(num, roles, gasOptions),
        testRoles,
        'MissingAnyOfRoles',
        {
          account: userWallet.address,
          roles,
        },
      );
    });

    it('should not revert when role account calls withAnyOfRoles function', async () => {
      const num = 5;
      const roles = [1, 2, 3];

      await expect(
        testRoles.connect(ownerWallet).setNumWithAnyRoles(num, roles),
      )
        .to.emit(testRoles, 'NumSet')
        .withArgs(num);
    });
  });

  describe('negative tests for role transfers', () => {
    beforeEach(async () => {
      const accounts = [ownerWallet.address];
      const roleSets = [[1, 2, 3]];

      testRoles = await testRolesFactory
        .deploy(accounts, roleSets)
        .then((d) => d.deployed());
    });

    it('should revert on acceptRoles if called by an account without all the proposed roles', async () => {
      const roles = [1, 2, 3];

      await testRoles
        .proposeRoles(userWallet.address, roles)
        .then((tx) => tx.wait());

      await expectRevert(
        (gasOptions) =>
          testRoles
            .connect(ownerWallet)
            .acceptRoles(ownerWallet.address, roles, gasOptions),
        testRoles,
        'InvalidProposedRoles',
        {
          fromAccount: ownerWallet.address,
          toAccount: ownerWallet.address,
          roles,
        },
      );
    });

    it('should revert on transferRoles if called by an account without all the proposed roles', async () => {
      const roles = [1, 2, 3];

      await testRoles
        .transferRoles(userWallet.address, [3])
        .then((tx) => tx.wait());

      await expectRevert(
        (gasOptions) =>
          testRoles
            .connect(ownerWallet)
            .transferRoles(userWallet.address, roles, gasOptions),
        testRoles,
        'MissingAllRoles',
        {
          account: ownerWallet.address,
          roles,
        },
      );
    });

    it('should revert on transferRoles if transferred to an invalid account', async () => {
      const roles = [1, 2, 3];

      await expectRevert(
        (gasOptions) => testRoles.transferRoles(AddressZero, roles, gasOptions),
        testRoles,
        'InvalidProposedAccount',
        {
          account: AddressZero,
        },
      );

      await expectRevert(
        (gasOptions) =>
          testRoles.transferRoles(ownerWallet.address, roles, gasOptions),
        testRoles,
        'InvalidProposedAccount',
        {
          account: ownerWallet.address,
        },
      );
    });

    it('should revert on proposeRoles if called by an account without all the proposed roles', async () => {
      const roles = [1, 2, 3];

      await testRoles
        .transferRoles(userWallet.address, [3])
        .then((tx) => tx.wait());

      await expectRevert(
        (gasOptions) =>
          testRoles
            .connect(ownerWallet)
            .proposeRoles(userWallet.address, roles, gasOptions),
        testRoles,
        'MissingAllRoles',
        {
          account: ownerWallet.address,
          roles,
        },
      );
    });

    it('should revert on proposeRoles if proposed to an invalid account', async () => {
      const roles = [1, 2, 3];

      await expectRevert(
        (gasOptions) =>
          testRoles
            .connect(ownerWallet)
            .proposeRoles(AddressZero, roles, gasOptions),
        testRoles,
        'InvalidProposedAccount',
        {
          account: AddressZero,
        },
      );

      await expectRevert(
        (gasOptions) =>
          testRoles
            .connect(ownerWallet)
            .proposeRoles(ownerWallet.address, roles, gasOptions),
        testRoles,
        'InvalidProposedAccount',
        {
          account: ownerWallet.address,
        },
      );
    });

    it('should revert on acceptRoles if called with incorrect proposed roles', async () => {
      const roles = [1, 2, 3];
      const incorrectRoles = [1, 2];

      await testRoles
        .proposeRoles(userWallet.address, roles)
        .then((tx) => tx.wait());

      await expectRevert(
        (gasOptions) =>
          testRoles
            .connect(userWallet)
            .acceptRoles(ownerWallet.address, incorrectRoles, gasOptions),
        testRoles,
        'InvalidProposedRoles',
        {
          fromAccount: ownerWallet.address,
          toAccount: userWallet.address,
          roles: incorrectRoles,
        },
      );
    });
  });

  describe('positive tests', () => {
    let roleSets;

    beforeEach(async () => {
      const accounts = [ownerWallet.address];
      roleSets = [[1, 2, 3]];

      testRoles = await testRolesFactory
        .deploy(accounts, roleSets)
        .then((d) => d.deployed());
    });

    it('should set the initial roles and return the current roles', async () => {
      const currentRoles = await testRoles.getAccountRoles(ownerWallet.address);

      expect(currentRoles).to.equal(14); // 14 is the binary representation of roles [1, 2, 3]
    });

    it('should return if an account has a specific role', async () => {
      const hasRole = await testRoles.hasRole(
        ownerWallet.address,
        roleSets[0][0],
      );

      expect(hasRole).to.be.true;

      const hasRoleNegative = await testRoles.hasRole(
        userWallet.address,
        roleSets[0][0],
      );

      expect(hasRoleNegative).to.be.false;
    });

    it('should return if an account has all the roles', async () => {
      const hasAllTheRoles = await testRoles.hasAllTheRoles(
        ownerWallet.address,
        roleSets[0],
      );

      expect(hasAllTheRoles).to.be.true;

      const hasAllTheRolesNegative = await testRoles.hasAllTheRoles(
        userWallet.address,
        roleSets[0],
      );

      expect(hasAllTheRolesNegative).to.be.false;
    });

    it('should return if an account has any of the roles', async () => {
      const hasAnyRoles = await testRoles.hasAnyOfRoles(
        ownerWallet.address,
        roleSets[0],
      );

      expect(hasAnyRoles).to.be.true;

      const hasAnyRolesNegative = await testRoles.hasAnyOfRoles(
        userWallet.address,
        roleSets[0],
      );

      expect(hasAnyRolesNegative).to.be.false;
    });

    it('should transfer roles in one step', async () => {
      const roles = [1, 2];
      const accountRoles = toAccountRoles(roles);

      await expect(testRoles.transferRoles(userWallet.address, roles))
        .to.emit(testRoles, 'RolesRemoved')
        .withArgs(ownerWallet.address, accountRoles)
        .to.emit(testRoles, 'RolesAdded')
        .withArgs(userWallet.address, accountRoles);

      expect(await testRoles.getAccountRoles(userWallet.address)).to.equal(
        accountRoles,
      ); // 6 is the binary representation of roles [1, 2]
      expect(await testRoles.getAccountRoles(ownerWallet.address)).to.equal(8); // 8 is a binary representation of role 3, other roles transferred
    });

    it('should propose new roles and accept roles', async () => {
      const roles = [2, 3];
      const accountRoles = toAccountRoles(roles);

      await expect(testRoles.proposeRoles(userWallet.address, roles))
        .to.emit(testRoles, 'RolesProposed')
        .withArgs(ownerWallet.address, userWallet.address, accountRoles);

      expect(
        await testRoles.getProposedRoles(
          ownerWallet.address,
          userWallet.address,
        ),
      ).to.equal(accountRoles); // 12 is the binary representation of roles [2, 3]

      expect(await testRoles.getAccountRoles(userWallet.address)).to.equal(0);

      await testRoles
        .connect(userWallet)
        .acceptRoles(ownerWallet.address, roles)
        .then((tx) => tx.wait());

      expect(
        await testRoles.getProposedRoles(
          ownerWallet.address,
          userWallet.address,
        ),
      ).to.equal(0); // cleared proposed roles
      expect(await testRoles.getAccountRoles(userWallet.address)).to.equal(12); // 12 is the binary representation of roles [2, 3]
      expect(await testRoles.getAccountRoles(ownerWallet.address)).to.equal(2); // 2 is a binary representation of role 1, other roles transferred
    });

    it('should add and remove single role', async () => {
      const role = 2;

      await expect(testRoles.addRole(userWallet.address, role))
        .to.emit(testRoles, 'RolesAdded')
        .withArgs(userWallet.address, 1 << role);

      expect(await testRoles.getAccountRoles(userWallet.address)).to.equal(
        1 << role,
      ); // 4 is the binary representation of roles [2]

      await expect(testRoles.removeRole(userWallet.address, role))
        .to.emit(testRoles, 'RolesRemoved')
        .withArgs(userWallet.address, 1 << role);

      expect(await testRoles.getAccountRoles(userWallet.address)).to.equal(0);
    });

    it('should transfer a single role in one step', async () => {
      const role = 2;
      const accountRoles = toAccountRoles([role]);

      await expect(
        testRoles.transferRole(ownerWallet.address, userWallet.address, role),
      )
        .to.emit(testRoles, 'RolesRemoved')
        .withArgs(ownerWallet.address, accountRoles)
        .to.emit(testRoles, 'RolesAdded')
        .withArgs(userWallet.address, accountRoles);

      expect(await testRoles.getAccountRoles(userWallet.address)).to.equal(
        accountRoles,
      );
      expect(await testRoles.getAccountRoles(ownerWallet.address)).to.equal(
        toAccountRoles([1, 3]),
      );
    });

    it('should propose a new role and accept it', async () => {
      const role = 2;
      const accountRoles = toAccountRoles([role]);

      await expect(testRoles.proposeRole(userWallet.address, role))
        .to.emit(testRoles, 'RolesProposed')
        .withArgs(ownerWallet.address, userWallet.address, accountRoles);

      expect(
        await testRoles.getProposedRoles(
          ownerWallet.address,
          userWallet.address,
        ),
      ).to.equal(accountRoles);

      expect(await testRoles.getAccountRoles(userWallet.address)).to.equal(0);

      await testRoles
        .connect(userWallet)
        .acceptRole(ownerWallet.address, role)
        .then((tx) => tx.wait());

      expect(
        await testRoles.getProposedRoles(
          ownerWallet.address,
          userWallet.address,
        ),
      ).to.equal(0); // cleared proposed roles
      expect(await testRoles.getAccountRoles(userWallet.address)).to.equal(
        accountRoles,
      ); // 12 is the binary representation of roles [2, 3]
      expect(await testRoles.getAccountRoles(ownerWallet.address)).to.equal(
        toAccountRoles([1, 3]),
      );
    });
  });
});
