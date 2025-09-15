;; LoanManager.clar

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-LOAN-ALREADY-EXISTS u101)
(define-constant ERR-INVALID-LOAN-AMOUNT u102)
(define-constant ERR-INVALID-INTEREST-RATE u103)
(define-constant ERR-INVALID-REPAYMENT-PERIOD u104)
(define-constant ERR-INVALID-GRACE-PERIOD u105)
(define-constant ERR-LOAN-NOT-FOUND u106)
(define-constant ERR-LOAN-NOT-ACTIVE u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-BUSINESS-NOT-VERIFIED u109)
(define-constant ERR-INVALID-MIN-LOAN u110)
(define-constant ERR-INVALID-MAX-LOAN u111)
(define-constant ERR-LOAN-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-LOANS-EXCEEDED u114)
(define-constant ERR-INVALID-LOAN-TYPE u115)
(define-constant ERR-INVALID-COLLATERAL-RATE u116)
(define-constant ERR-INVALID-LOCATION u117)
(define-constant ERR-INVALID-CURRENCY u118)
(define-constant ERR-INVALID-STATUS u119)
(define-constant ERR-INSUFFICIENT-REPAYMENT u120)
(define-constant ERR-LOAN-ALREADY-REPAID u121)
(define-constant ERR-INVALID-PENALTY-RATE u122)
(define-constant ERR-INVALID-VOTING-THRESHOLD u123)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u124)
(define-constant ERR-INVALID-CREATION-FEE u125)

(define-data-var next-loan-id uint u0)
(define-data-var max-loans uint u1000)
(define-data-var creation-fee uint u1000)
(define-data-var authority-contract (optional principal) none)

(define-map loans
  uint
  {
    business: principal,
    amount: uint,
    interest-rate: uint,
    repayment-period: uint,
    grace-period: uint,
    timestamp: uint,
    creator: principal,
    loan-type: (string-utf8 50),
    collateral-rate: uint,
    location: (string-utf8 100),
    currency: (string-utf8 20),
    status: bool,
    min-loan: uint,
    max-loan: uint,
    repaid-amount: uint,
    penalty-rate: uint,
    voting-threshold: uint
  }
)

(define-map loans-by-business
  principal
  uint)

(define-map loan-updates
  uint
  {
    update-amount: uint,
    update-interest-rate: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-loan (id uint))
  (map-get? loans id)
)

(define-read-only (get-loan-updates (id uint))
  (map-get? loan-updates id)
)

(define-read-only (is-loan-registered (business principal))
  (is-some (map-get? loans-by-business business))
)

(define-private (validate-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR-INVALID-LOAN-AMOUNT))
)

(define-private (validate-interest-rate (rate uint))
  (if (<= rate u20)
      (ok true)
      (err ERR-INVALID-INTEREST-RATE))
)

(define-private (validate-repayment-period (period uint))
  (if (> period u0)
      (ok true)
      (err ERR-INVALID-REPAYMENT-PERIOD))
)

(define-private (validate-grace-period (period uint))
  (if (<= period u30)
      (ok true)
      (err ERR-INVALID-GRACE-PERIOD))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-loan-type (type (string-utf8 50)))
  (if (or (is-eq type "micro") (is-eq type "small") (is-eq type "impact"))
      (ok true)
      (err ERR-INVALID-LOAN-TYPE))
)

(define-private (validate-collateral-rate (rate uint))
  (if (<= rate u100)
      (ok true)
      (err ERR-INVALID-COLLATERAL-RATE))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-min-loan (min uint))
  (if (> min u0)
      (ok true)
      (err ERR-INVALID-MIN-LOAN))
)

(define-private (validate-max-loan (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX-LOAN))
)

(define-private (validate-penalty-rate (rate uint))
  (if (<= rate u100)
      (ok true)
      (err ERR-INVALID-PENALTY-RATE))
)

(define-private (validate-voting-threshold (threshold uint))
  (if (and (> threshold u0) (<= threshold u100))
      (ok true)
      (err ERR-INVALID-VOTING-THRESHOLD))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-loans (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX_LOANS-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-loans new-max)
    (ok true)
  )
)

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID_CREATION_FEE))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set creation-fee new-fee)
    (ok true)
  )
)

(define-public (issue-loan
  (business principal)
  (amount uint)
  (interest-rate uint)
  (repayment-period uint)
  (grace-period uint)
  (loan-type (string-utf8 50))
  (collateral-rate uint)
  (location (string-utf8 100))
  (currency (string-utf8 20))
  (min-loan uint)
  (max-loan uint)
  (penalty-rate uint)
  (voting-threshold uint)
)
  (let (
        (next-id (var-get next-loan-id))
        (current-max (var-get max-loans))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX_LOANS-EXCEEDED))
    (try! (validate-amount amount))
    (try! (validate-interest-rate interest-rate))
    (try! (validate-repayment-period repayment-period))
    (try! (validate-grace-period grace-period))
    (try! (validate-loan-type loan-type))
    (try! (validate-collateral-rate collateral-rate))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-min-loan min-loan))
    (try! (validate-max-loan max-loan))
    (try! (validate-penalty-rate penalty-rate))
    (try! (validate-voting-threshold voting-threshold))
    (asserts! (is-none (map-get? loans-by-business business)) (err ERR_LOAN-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get creation-fee) tx-sender authority-recipient))
    )
    (map-set loans next-id
      {
        business: business,
        amount: amount,
        interest-rate: interest-rate,
        repayment-period: repayment-period,
        grace-period: grace-period,
        timestamp: block-height,
        creator: tx-sender,
        loan-type: loan-type,
        collateral-rate: collateral-rate,
        location: location,
        currency: currency,
        status: true,
        min-loan: min-loan,
        max-loan: max-loan,
        repaid-amount: u0,
        penalty-rate: penalty-rate,
        voting-threshold: voting-threshold
      }
    )
    (map-set loans-by-business business next-id)
    (var-set next-loan-id (+ next-id u1))
    (print { event: "loan-issued", id: next-id })
    (ok next-id)
  )
)

(define-public (repay-loan (loan-id uint) (repayment-amount uint))
  (let ((loan (map-get? loans loan-id)))
    (match loan
      l
        (begin
          (asserts! (is-eq (get business l) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (get status l) (err ERR-LOAN-NOT-ACTIVE))
          (asserts! (> repayment-amount u0) (err ERR-INSUFFICIENT-REPAYMENT))
          (asserts! (< (get repaid-amount l) (get amount l)) (err ERR-LOAN-ALREADY-REPAID))
          (let ((new-repaid (+ (get repaid-amount l) repayment-amount)))
            (map-set loans loan-id
              (merge l { repaid-amount: new-repaid }))
            (if (>= new-repaid (get amount l))
                (map-set loans loan-id
                  (merge l { status: false }))
                (ok false)
            )
          )
          (print { event: "loan-repaid", id: loan-id, amount: repayment-amount })
          (ok true)
        )
      (err ERR-LOAN-NOT-FOUND)
    )
  )
)

(define-public (update-loan
  (loan-id uint)
  (update-amount uint)
  (update-interest-rate uint)
)
  (let ((loan (map-get? loans loan-id)))
    (match loan
      l
        (begin
          (asserts! (is-eq (get creator l) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-amount update-amount))
          (try! (validate-interest-rate update-interest-rate))
          (let ((existing (map-get? loans-by-business (get business l))))
            (match existing
              existing-id
                (asserts! (is-eq existing-id loan-id) (err ERR_LOAN-ALREADY-EXISTS))
              (begin true)
            )
          )
          (map-set loans loan-id
            {
              business: (get business l),
              amount: update-amount,
              interest-rate: update-interest-rate,
              repayment-period: (get repayment-period l),
              grace-period: (get grace-period l),
              timestamp: block-height,
              creator: (get creator l),
              loan-type: (get loan-type l),
              collateral-rate: (get collateral-rate l),
              location: (get location l),
              currency: (get currency l),
              status: (get status l),
              min-loan: (get min-loan l),
              max-loan: (get max-loan l),
              repaid-amount: (get repaid-amount l),
              penalty-rate: (get penalty-rate l),
              voting-threshold: (get voting-threshold l)
            }
          )
          (map-set loan-updates loan-id
            {
              update-amount: update-amount,
              update-interest-rate: update-interest-rate,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "loan-updated", id: loan-id })
          (ok true)
        )
      (err ERR_LOAN-NOT-FOUND)
    )
  )
)

(define-public (get-loan-count)
  (ok (var-get next-loan-id))
)

(define-public (check-loan-existence (business principal))
  (ok (is-loan-registered business))
)