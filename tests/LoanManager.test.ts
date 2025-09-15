import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_LOAN_ALREADY_EXISTS = 101;
const ERR_INVALID_LOAN_AMOUNT = 102;
const ERR_INVALID_INTEREST_RATE = 103;
const ERR_INVALID_REPAYMENT_PERIOD = 104;
const ERR_INVALID_GRACE_PERIOD = 105;
const ERR_LOAN_NOT_FOUND = 106;
const ERR_LOAN_NOT_ACTIVE = 107;
const ERR_INVALID_LOAN_TYPE = 115;
const ERR_INVALID_COLLATERAL_RATE = 116;
const ERR_INVALID_LOCATION = 117;
const ERR_INVALID_CURRENCY = 118;
const ERR_INVALID_MIN_LOAN = 110;
const ERR_INVALID_MAX_LOAN = 111;
const ERR_MAX_LOANS_EXCEEDED = 114;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_AUTHORITY_NOT_VERIFIED = 124;
const ERR_INSUFFICIENT_REPAYMENT = 120;
const ERR_LOAN_ALREADY_REPAID = 121;
const ERR_INVALID_PENALTY_RATE = 122;
const ERR_INVALID_VOTING_THRESHOLD = 123;

interface Loan {
  business: string;
  amount: number;
  interestRate: number;
  repaymentPeriod: number;
  gracePeriod: number;
  timestamp: number;
  creator: string;
  loanType: string;
  collateralRate: number;
  location: string;
  currency: string;
  status: boolean;
  minLoan: number;
  maxLoan: number;
  repaidAmount: number;
  penaltyRate: number;
  votingThreshold: number;
}

interface LoanUpdate {
  updateAmount: number;
  updateInterestRate: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class LoanManagerMock {
  state: {
    nextLoanId: number;
    maxLoans: number;
    creationFee: number;
    authorityContract: string | null;
    loans: Map<number, Loan>;
    loanUpdates: Map<number, LoanUpdate>;
    loansByBusiness: Map<string, number>;
  } = {
    nextLoanId: 0,
    maxLoans: 1000,
    creationFee: 1000,
    authorityContract: null,
    loans: new Map(),
    loanUpdates: new Map(),
    loansByBusiness: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextLoanId: 0,
      maxLoans: 1000,
      creationFee: 1000,
      authorityContract: null,
      loans: new Map(),
      loanUpdates: new Map(),
      loansByBusiness: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setCreationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  issueLoan(
    business: string,
    amount: number,
    interestRate: number,
    repaymentPeriod: number,
    gracePeriod: number,
    loanType: string,
    collateralRate: number,
    location: string,
    currency: string,
    minLoan: number,
    maxLoan: number,
    penaltyRate: number,
    votingThreshold: number
  ): Result<number> {
    if (this.state.nextLoanId >= this.state.maxLoans) return { ok: false, value: ERR_MAX_LOANS_EXCEEDED };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_LOAN_AMOUNT };
    if (interestRate > 20) return { ok: false, value: ERR_INVALID_INTEREST_RATE };
    if (repaymentPeriod <= 0) return { ok: false, value: ERR_INVALID_REPAYMENT_PERIOD };
    if (gracePeriod > 30) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    if (!["micro", "small", "impact"].includes(loanType)) return { ok: false, value: ERR_INVALID_LOAN_TYPE };
    if (collateralRate > 100) return { ok: false, value: ERR_INVALID_COLLATERAL_RATE };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (minLoan <= 0) return { ok: false, value: ERR_INVALID_MIN_LOAN };
    if (maxLoan <= 0) return { ok: false, value: ERR_INVALID_MAX_LOAN };
    if (penaltyRate > 100) return { ok: false, value: ERR_INVALID_PENALTY_RATE };
    if (votingThreshold <= 0 || votingThreshold > 100) return { ok: false, value: ERR_INVALID_VOTING_THRESHOLD };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.loansByBusiness.has(business)) return { ok: false, value: ERR_LOAN_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextLoanId;
    const loan: Loan = {
      business,
      amount,
      interestRate,
      repaymentPeriod,
      gracePeriod,
      timestamp: this.blockHeight,
      creator: this.caller,
      loanType,
      collateralRate,
      location,
      currency,
      status: true,
      minLoan,
      maxLoan,
      repaidAmount: 0,
      penaltyRate,
      votingThreshold,
    };
    this.state.loans.set(id, loan);
    this.state.loansByBusiness.set(business, id);
    this.state.nextLoanId++;
    return { ok: true, value: id };
  }

  getLoan(id: number): Loan | null {
    return this.state.loans.get(id) || null;
  }

  repayLoan(id: number, repaymentAmount: number): Result<boolean> {
    const loan = this.state.loans.get(id);
    if (!loan) return { ok: false, value: false };
    if (loan.business !== this.caller) return { ok: false, value: false };
    if (!loan.status) return { ok: false, value: false };
    if (repaymentAmount <= 0) return { ok: false, value: false };
    if (loan.repaidAmount >= loan.amount) return { ok: false, value: false };
    const newRepaid = loan.repaidAmount + repaymentAmount;
    const updated: Loan = {
      ...loan,
      repaidAmount: newRepaid,
      status: newRepaid >= loan.amount ? false : true,
    };
    this.state.loans.set(id, updated);
    return { ok: true, value: true };
  }

  updateLoan(id: number, updateAmount: number, updateInterestRate: number): Result<boolean> {
    const loan = this.state.loans.get(id);
    if (!loan) return { ok: false, value: false };
    if (loan.creator !== this.caller) return { ok: false, value: false };
    if (updateAmount <= 0) return { ok: false, value: false };
    if (updateInterestRate > 20) return { ok: false, value: false };

    const updated: Loan = {
      ...loan,
      amount: updateAmount,
      interestRate: updateInterestRate,
      timestamp: this.blockHeight,
    };
    this.state.loans.set(id, updated);
    this.state.loanUpdates.set(id, {
      updateAmount,
      updateInterestRate,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getLoanCount(): Result<number> {
    return { ok: true, value: this.state.nextLoanId };
  }

  checkLoanExistence(business: string): Result<boolean> {
    return { ok: true, value: this.state.loansByBusiness.has(business) };
  }
}

describe("LoanManager", () => {
  let contract: LoanManagerMock;

  beforeEach(() => {
    contract = new LoanManagerMock();
    contract.reset();
  });

  it("issues a loan successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.issueLoan(
      "STBUSINESS1",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const loan = contract.getLoan(0);
    expect(loan?.business).toBe("STBUSINESS1");
    expect(loan?.amount).toBe(1000);
    expect(loan?.interestRate).toBe(10);
    expect(loan?.repaymentPeriod).toBe(30);
    expect(loan?.gracePeriod).toBe(7);
    expect(loan?.loanType).toBe("micro");
    expect(loan?.collateralRate).toBe(50);
    expect(loan?.location).toBe("LocationX");
    expect(loan?.currency).toBe("STX");
    expect(loan?.minLoan).toBe(500);
    expect(loan?.maxLoan).toBe(2000);
    expect(loan?.penaltyRate).toBe(5);
    expect(loan?.votingThreshold).toBe(50);
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate loans for business", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.issueLoan(
      "STBUSINESS1",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    const result = contract.issueLoan(
      "STBUSINESS1",
      2000,
      15,
      60,
      14,
      "small",
      60,
      "LocationY",
      "USD",
      1000,
      3000,
      10,
      60
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_LOAN_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const result = contract.issueLoan(
      "STBUSINESS2",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects loan issuance without authority contract", () => {
    const result = contract.issueLoan(
      "STBUSINESS3",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid loan amount", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.issueLoan(
      "STBUSINESS4",
      0,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_LOAN_AMOUNT);
  });

  it("rejects invalid interest rate", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.issueLoan(
      "STBUSINESS5",
      1000,
      21,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_INTEREST_RATE);
  });

  it("rejects invalid loan type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.issueLoan(
      "STBUSINESS6",
      1000,
      10,
      30,
      7,
      "invalid",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_LOAN_TYPE);
  });

  it("repays a loan successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.issueLoan(
      "STBUSINESS7",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    contract.caller = "STBUSINESS7";
    const result = contract.repayLoan(0, 500);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const loan = contract.getLoan(0);
    expect(loan?.repaidAmount).toBe(500);
    expect(loan?.status).toBe(true);
    const result2 = contract.repayLoan(0, 500);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(true);
    const loan2 = contract.getLoan(0);
    expect(loan2?.repaidAmount).toBe(1000);
    expect(loan2?.status).toBe(false);
  });

  it("rejects repayment for non-existent loan", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.repayLoan(99, 500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects repayment by non-business", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.issueLoan(
      "STBUSINESS8",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    contract.caller = "ST3FAKE";
    const result = contract.repayLoan(0, 500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects repayment on inactive loan", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.issueLoan(
      "STBUSINESS9",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    contract.caller = "STBUSINESS9";
    contract.repayLoan(0, 1000);
    const result = contract.repayLoan(0, 500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects insufficient repayment amount", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.issueLoan(
      "STBUSINESS10",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    contract.caller = "STBUSINESS10";
    const result = contract.repayLoan(0, 0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("updates a loan successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.issueLoan(
      "STBUSINESS11",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    const result = contract.updateLoan(0, 1500, 12);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const loan = contract.getLoan(0);
    expect(loan?.amount).toBe(1500);
    expect(loan?.interestRate).toBe(12);
    const update = contract.state.loanUpdates.get(0);
    expect(update?.updateAmount).toBe(1500);
    expect(update?.updateInterestRate).toBe(12);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent loan", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateLoan(99, 1500, 12);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-creator", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.issueLoan(
      "STBUSINESS12",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateLoan(0, 1500, 12);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets creation fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setCreationFee(2000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.creationFee).toBe(2000);
    contract.issueLoan(
      "STBUSINESS13",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    expect(contract.stxTransfers).toEqual([{ amount: 2000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects creation fee change without authority contract", () => {
    const result = contract.setCreationFee(2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct loan count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.issueLoan(
      "STBUSINESS14",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    contract.issueLoan(
      "STBUSINESS15",
      2000,
      15,
      60,
      14,
      "small",
      60,
      "LocationY",
      "USD",
      1000,
      3000,
      10,
      60
    );
    const result = contract.getLoanCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks loan existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.issueLoan(
      "STBUSINESS16",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    const result = contract.checkLoanExistence("STBUSINESS16");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkLoanExistence("STNONEXISTENT");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses loan parameters with Clarity types", () => {
    const business = stringUtf8CV("STBUSINESS17");
    const amount = uintCV(1000);
    const interestRate = uintCV(10);
    expect(business.value).toBe("STBUSINESS17");
    expect(amount.value).toEqual(BigInt(1000));
    expect(interestRate.value).toEqual(BigInt(10));
  });

  it("rejects loan issuance with max loans exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxLoans = 1;
    contract.issueLoan(
      "STBUSINESS18",
      1000,
      10,
      30,
      7,
      "micro",
      50,
      "LocationX",
      "STX",
      500,
      2000,
      5,
      50
    );
    const result = contract.issueLoan(
      "STBUSINESS19",
      2000,
      15,
      60,
      14,
      "small",
      60,
      "LocationY",
      "USD",
      1000,
      3000,
      10,
      60
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_LOANS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});