const euro = new Intl.NumberFormat('el-GR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})

const number = new Intl.NumberFormat('el-GR', {
  maximumFractionDigits: 2,
})

function q(id) {
  return document.getElementById(id)
}

function value(id, fallback = 0) {
  const el = q(id)
  if (!el) return fallback
  const parsed = Number(String(el.value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function setResults(items, notes = []) {
  const output = q('results')
  if (!output) return
  output.innerHTML =
    items
      .map(
        (item) => `
    <div class="metric ${item.kind || ''}">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
    </div>
  `,
      )
      .join('') +
    (notes.length
      ? `
    <ul class="breakdown">${notes.map((note) => `<li>${note}</li>`).join('')}</ul>
  `
      : '')
}

function progressiveTax(income, children, age) {
  const childBand = Math.min(Math.max(children, 0), 5)
  const ratesByChildren = {
    0: [0.09, 0.2, 0.26, 0.34, 0.39, 0.44],
    1: [0.09, 0.18, 0.24, 0.34, 0.39, 0.44],
    2: [0.09, 0.16, 0.22, 0.34, 0.39, 0.44],
    3: [0.09, 0.09, 0.2, 0.34, 0.39, 0.44],
    4: [0, 0, 0.18, 0.34, 0.39, 0.44],
    5: [0, 0, Math.max(0, 0.18 - Math.max(children - 4, 0) * 0.02), 0.34, 0.39, 0.44],
  }
  const rates = [...ratesByChildren[childBand]]
  if (age <= 25) {
    rates[0] = 0
    rates[1] = 0
  } else if (age <= 30) {
    rates[1] = children >= 4 ? 0 : Math.min(rates[1], 0.09)
  }
  const brackets = [10000, 10000, 10000, 10000, 20000, Infinity]
  let remaining = Math.max(0, income)
  let tax = 0
  for (let i = 0; i < brackets.length; i += 1) {
    const slice = Math.min(remaining, brackets[i])
    tax += slice * rates[i]
    remaining -= slice
    if (remaining <= 0) break
  }
  const credits = [777, 900, 1120, 1340, 1580, 1780 + Math.max(0, children - 5) * 220]
  let credit = credits[Math.min(children, 5)]
  if (income > 12000) {
    credit = Math.max(0, credit - Math.ceil((income - 12000) / 1000) * 20)
  }
  return Math.max(0, tax - Math.min(tax, credit))
}

function calculateSalary() {
  const gross = value('gross')
  const payments = value('payments', 14)
  const employeeRate = value('employeeRate', 13.37) / 100
  const employerRate = value('employerRate', 21.79) / 100
  const cap = value('cap', 7761.94)
  const children = value('children', 0)
  const age = value('age', 35)
  const monthlyBase = Math.min(gross, cap)
  const employeeEfka = monthlyBase * employeeRate
  const employerEfka = monthlyBase * employerRate
  const annualTaxable = Math.max(0, gross * payments - employeeEfka * payments)
  const annualTax = progressiveTax(annualTaxable, children, age)
  const withholding = annualTax / payments
  const net = gross - employeeEfka - withholding
  setResults(
    [
      { label: 'Καθαρό ανά πληρωμή', value: euro.format(net), kind: 'total' },
      { label: 'Κράτηση εργαζομένου', value: euro.format(employeeEfka) },
      { label: 'Φ.Μ.Υ. ανά πληρωμή', value: euro.format(withholding) },
      { label: 'Κόστος εργοδότη', value: euro.format(gross + employerEfka), kind: 'warning' },
    ],
    [
      `Ετήσιο φορολογητέο εισόδημα: ${euro.format(annualTaxable)}.`,
      `Ετήσιος φόρος μετά τη βασική μείωση: ${euro.format(annualTax)}.`,
      'Οι συντελεστές είναι προεπιλογές και μπορούν να αλλαχθούν από τη φόρμα.',
    ],
  )
}

function severanceMonths(years) {
  if (years < 1) return 0
  if (years < 4) return 2
  if (years < 6) return 3
  if (years < 8) return 4
  if (years < 10) return 5
  if (years < 11) return 6
  if (years < 12) return 7
  if (years < 13) return 8
  if (years < 14) return 9
  if (years < 15) return 10
  if (years < 16) return 11
  return 12
}

function frozenSeveranceMonths(yearsAt2012) {
  if (yearsAt2012 < 17) return 0
  if (yearsAt2012 >= 28) return 12
  return Math.floor(yearsAt2012) - 16
}

function noticeMonths(years) {
  if (years < 1) return 0
  if (years < 2) return 1
  if (years < 5) return 2
  if (years < 10) return 3
  return 4
}

function calculateSeverance() {
  const gross = value('gross')
  const years = value('years')
  const yearsAt2012 = value('yearsAt2012')
  const status = q('status').value
  const baseMonths = severanceMonths(years)
  const additionalMonths = frozenSeveranceMonths(yearsAt2012)
  const frozenTotalMonths = additionalMonths > 0 ? 12 + additionalMonths : 0
  const entitlementMonths = Math.max(baseMonths, frozenTotalMonths)
  const cappedBaseGross = Math.min(gross, 5385.6)
  const cappedAdditionalGross = Math.min(gross, 1714.286)
  const sixthFactor = 14 / 12
  const grossWithSixth = gross * sixthFactor
  const cappedBaseWithSixth = cappedBaseGross * sixthFactor
  const cappedAdditionalWithSixth = cappedAdditionalGross * sixthFactor
  const requiredNoticeMonths = noticeMonths(years)
  let factor = 1
  if (status === 'notice') factor = 0.5
  if (status === 'pension') factor = 0.4

  let baseCompensation = 0
  let additionalCompensation = 0
  if (status === 'pension') {
    baseCompensation = cappedBaseGross * entitlementMonths * sixthFactor * factor
  } else if (entitlementMonths <= 12) {
    baseCompensation = cappedBaseGross * entitlementMonths * sixthFactor * factor
  } else {
    baseCompensation = cappedBaseGross * 12 * sixthFactor * factor
    additionalCompensation = cappedAdditionalGross * (entitlementMonths - 12) * sixthFactor * factor
  }

  const total = baseCompensation + additionalCompensation
  setResults(
    [
      { label: 'Συνολική αποζημίωση', value: euro.format(total), kind: 'total' },
      { label: 'Βασική αποζημίωση', value: euro.format(baseCompensation) },
      {
        label: 'Επιπλέον αποζημίωση',
        value: euro.format(additionalCompensation),
        kind: additionalCompensation ? 'warning' : '',
      },
      {
        label: 'Μήνες προειδοποίησης',
        value: status === 'notice' ? `${number.format(requiredNoticeMonths)} μήνες` : 'Δεν εφαρμόζεται',
      },
      { label: 'Δικαιούμενοι μήνες', value: `${number.format(entitlementMonths * factor)} μισθοί` },
      {
        label: 'Μήνες επιπλέον κομματιού',
        value: `${status === 'pension' ? '0' : number.format(Math.max(0, entitlementMonths - 12) * factor)} μισθοί`,
      },
      { label: 'Αναγωγή μισθού σε 14/12', value: euro.format(grossWithSixth), kind: 'warning' },
      { label: 'Βάση βασικού κομματιού', value: euro.format(cappedBaseGross) },
      { label: 'Βάση βασικού με 14/12', value: euro.format(cappedBaseWithSixth) },
      { label: 'Βάση επιπλέον κομματιού', value: euro.format(cappedAdditionalGross) },
      { label: 'Βάση επιπλέον με 14/12', value: euro.format(cappedAdditionalWithSixth) },
    ],
    [
      'Ο πολλαπλασιασμός 14/12 ενσωματώνει το +1/6 στις τακτικές αποδοχές.',
      'Στο βασικό κομμάτι εφαρμόζεται πλαφόν μικτού μισθού 5.385,60 ευρώ.',
      'Στο επιπλέον κομμάτι εφαρμόζεται πλαφόν μικτού μισθού 1.714,286 ευρώ, δηλαδή 2.000 ευρώ μετά το 14/12.',
      'Στην επιλογή σύνταξης η Ergatiká υπολογίζει όλο το δικαίωμα με 40% και δεν εμφανίζει ξεχωριστό επιπλέον κομμάτι.',
    ],
  )
}

function calculateGifts() {
  const gross = value('gross')
  const christmasDays = Math.min(value('christmasDays', 245), 245)
  const easterDays = Math.min(value('easterDays', 120), 120)
  const leaveMonths = Math.min(value('leaveMonths', 12), 12)
  const giftFactor = 1.04166666
  const christmas = ((gross * christmasDays) / 245) * giftFactor
  const easter = ((gross * 0.5 * easterDays) / 120) * giftFactor
  const leaveAllowance = (gross * 0.5 * leaveMonths) / 12
  setResults(
    [
      { label: 'Δώρο Πάσχα', value: euro.format(easter), kind: 'total' },
      { label: 'Επίδομα άδειας', value: euro.format(leaveAllowance), kind: 'total' },
      { label: 'Δώρο Χριστουγέννων', value: euro.format(christmas), kind: 'total' },
      // { label: 'Σύνολο περιόδου', value: euro.format(christmas + easter + leaveAllowance), kind: 'warning' },
    ],
    [
      'Τα δώρα πολλαπλασιάζονται με συντελεστή 1,04166666, δηλαδή 1 + 1/24 του μισθού.',
      'Πλήρες δώρο Χριστουγέννων θεωρείται ένας μηνιαίος μισθός για όλη την περίοδο 1/5-31/12.',
      'Πλήρες δώρο Πάσχα υπολογίζεται εδώ ως μισός μηνιαίος μισθός. Το επίδομα άδειας εμφανίζεται χωριστά χωρίς τον συντελεστή δώρων.',
    ],
  )
}

function calculateOvertime() {
  const gross = value('gross')
  const regularHours = value('regularHours', 40)
  const hourly = regularHours > 0 ? ((gross / 25) * 6) / regularHours : 0
  const columns = [
    { label: 'Απλό', multiplier: 1, note: '' },
    { label: 'Νύχτα', multiplier: 1.25, note: '25%' },
    { label: 'Κυριακή-Αργία', multiplier: 1.75, note: '75%' },
    { label: 'Αργία-νύχτα', multiplier: 2, note: '100%' },
  ]
  const rows = [
    { label: 'Μόνο προσαύξηση', factor: 0, mode: 'premium' },
    { label: 'Ωρομίσθιο + προσαύξηση', factor: 1, mode: 'total' },
    { label: 'Ωρομίσθιο υπερεργασίας (+20%)', factor: 1.2, mode: 'total' },
    { label: 'Ωρομίσθιο νόμιμης υπερωρίας (+40%)', factor: 1.4, mode: 'total' },
    { label: 'Ωρομίσθιο παράνομης υπερωρίας (+80%)', factor: 1.8, mode: 'total' },
  ]
  const output = q('results')
  if (!output) return
  output.innerHTML = `
    <div class="metric total">
      <span>Βασικό ωρομίσθιο</span>
      <strong>${euro.format(hourly)}</strong>
    </div>
    <div class="metric">
      <span>Ημερομίσθιο 8 ωρών</span>
      <strong>${euro.format(hourly * 8)}</strong>
    </div>
    <div class="table-wrap">
      <table class="rate-table">
        <thead>
          <tr>
            <th>Υπολογισμός</th>
            ${columns.map((column) => `<th>${column.label}<span>${column.note}</span></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
            <tr>
              <td>${row.label}</td>
              ${columns
                .map((column) => {
                  const amount =
                    row.mode === 'premium'
                      ? hourly * (column.multiplier - 1)
                      : hourly * column.multiplier * row.factor
                  return `<td>${euro.format(amount)}</td>`
                })
                .join('')}
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <ul class="breakdown">
      <li>Το ωρομίσθιο προκύπτει από μισθός / 25 * 6 / συμβατικές ώρες εβδομάδας. Δηλωμένο εβδομαδιαίο ωράριο: ${number.format(regularHours)} ώρες.</li>
      <li>Η υπερεργασία και η υπερωρία υπολογίζονται πάνω στο προσαυξημένο ωρομίσθιο της αντίστοιχης στήλης.</li>
    </ul>
  `
}

function leaveDays(schedule, yearsSame, priorYears) {
  const sixDay = schedule === '6'
  const totalYears = yearsSame + priorYears
  if (totalYears >= 12) return sixDay ? 30 : 25
  if (yearsSame >= 10) return sixDay ? 30 : 25
  if (yearsSame < 1) return sixDay ? 24 : 20
  if (yearsSame < 2) return sixDay ? 25 : 21
  if (yearsSame < 25) return sixDay ? 26 : 22
  return sixDay ? 31 : 26
}

function calculateLeave() {
  const gross = value('gross')
  const schedule = q('schedule').value
  const yearsSame = value('yearsSame')
  const priorYears = value('yearsTotal')
  const monthsWorked = Math.min(value('monthsWorked', 12), 12)
  const totalYears = yearsSame + priorYears
  const days = leaveDays(schedule, yearsSame, priorYears)
  const prorated = (days * monthsWorked) / 12
  const daily = gross / 25
  const allowance = (gross * 0.5 * monthsWorked) / 12
  setResults(
    [
      { label: 'Ημέρες κανονικής άδειας', value: `${number.format(prorated)} ημέρες`, kind: 'total' },
      { label: 'Πλήρες ετήσιο δικαίωμα', value: `${days} ημέρες` },
      { label: 'Ενδεικτική αξία άδειας', value: euro.format(prorated * daily) },
      { label: 'Επίδομα άδειας', value: euro.format(allowance), kind: 'warning' },
    ],
    [
      'Ο υπολογισμός διαχωρίζει πενθήμερη και εξαήμερη εργασία.',
      `Συνολική προϋπηρεσία για τον έλεγχο 12ετίας: ${number.format(totalYears)} έτη.`,
      'Για ειδικές άδειες, μερική απασχόληση ή συλλογικές συμβάσεις χρειάζεται επιβεβαίωση.',
    ],
  )
}

function calculateMinimumSalary() {
  const hours = value('weeklyHours', 40)
  const triennials = value('triennials', 0)
  const marriageAllowance = q('marriageAllowance')?.checked ? 0.1 : 0
  const baseSalary = 920
  const maxTriennials = 3
  const appliedTriennials = Math.min(Math.max(0, Math.floor(triennials)), maxTriennials)
  const increment = appliedTriennials * 0.1
  const fullTimeAmount = baseSalary * (1 + increment + marriageAllowance)
  const hoursRatio = hours > 0 ? Math.min(hours / 40, 1) : 0
  const proratedMonthly = fullTimeAmount * hoursRatio
  const giftFactor = 1.04166666
  const easterGift = proratedMonthly * 0.5 * giftFactor
  const leaveAllowance = proratedMonthly * 0.5
  const christmasGift = proratedMonthly * giftFactor
  const annualAmount = proratedMonthly * 12 + easterGift + leaveAllowance + christmasGift
  const hourly = hours > 0 ? ((fullTimeAmount / 25) * 6) / 40 : 0
  setResults(
    [
      {
        label: 'Κατώτατος μηνιαίος μισθός',
        value: euro.format(fullTimeAmount),
        kind: 'total',
      },
      { label: 'Βασικό ποσό 2026', value: euro.format(baseSalary) },
      { label: 'Προσαύξηση προϋπηρεσίας', value: `${number.format(increment * 100)}%` },
      { label: 'Επίδομα γάμου', value: marriageAllowance ? '10%' : 'Δεν εφαρμόζεται' },
      {
        label: 'Μηνιαίος μισθός με αναλογία ωραρίου',
        value: euro.format(proratedMonthly),
        kind: 'warning',
      },
      { label: 'Δώρο Πάσχα', value: euro.format(easterGift) },
      { label: 'Επίδομα αδείας', value: euro.format(leaveAllowance) },
      { label: 'Δώρο Χριστουγέννων', value: euro.format(christmasGift) },
      { label: 'Ετήσιο Ποσό', value: euro.format(annualAmount), kind: 'total' },
      { label: 'Ωρομίσθιο', value: euro.format(hourly) },
    ],
    [
      'Από 1/4/2026 ο κατώτατος μισθός πλήρους απασχόλησης είναι 920,00 ευρώ και το κατώτατο ημερομίσθιο 41,09 ευρώ.',
      'Για μισθωτούς εφαρμόζεται 10% ανά τριετία έως 3 τριετίες.',
      'Αν επιλεγεί, το επίδομα γάμου προστίθεται ως επιπλέον 10% πάνω στο βασικό ποσό.',
      'Τα δώρα Πάσχα και Χριστουγέννων υπολογίζονται με συντελεστή 1,04166666. Το επίδομα αδείας υπολογίζεται ως μισό μηνιαίο ποσό.',
      'Η προϋπηρεσία αναγνωρίζεται για περιόδους πριν από 14/2/2012 και μετά από 1/1/2024, σύμφωνα με την τρέχουσα ενημέρωση του Υπουργείου Εργασίας.',
    ],
  )
}

function calculateMinimumDaily() {
  const triennials = value('triennials', 0)
  const weeklyHours = value('weeklyHours', 40)
  const weeklyDays = value('weeklyDays', 6)
  const paidDaysMonth = value('paidDaysMonth', 26)
  const marriageAllowance = q('marriageAllowance')?.checked ? 0.1 : 0
  const baseDaily = 41.09
  const appliedTriennials = Math.min(Math.max(0, Math.floor(triennials)), 6)
  const increment = appliedTriennials * 0.05
  const daily = baseDaily * (1 + increment + marriageAllowance)
  const monthlyEstimate = daily * Math.max(0, paidDaysMonth)
  const weeklyEstimate = daily * Math.max(0, weeklyDays)
  const giftFactor = 1.04166666
  const easterGift = daily * 15 * giftFactor
  const leaveAllowance = daily * 13
  const christmasGift = daily * 25 * giftFactor
  const annualEstimate = monthlyEstimate * 12 + easterGift + leaveAllowance + christmasGift
  const hourly = weeklyHours > 0 ? (daily * 6) / weeklyHours : 0
  setResults(
    [
      { label: 'Κατώτατο ημερομίσθιο', value: euro.format(daily), kind: 'total' },
      { label: 'Βασικό ημερομίσθιο 2026', value: euro.format(baseDaily) },
      { label: 'Προσαύξηση προϋπηρεσίας', value: `${number.format(increment * 100)}%` },
      { label: 'Επίδομα γάμου', value: marriageAllowance ? '10%' : 'Δεν εφαρμόζεται' },
      { label: 'Εκτίμηση εβδομαδιαίων αποδοχών', value: euro.format(weeklyEstimate), kind: 'warning' },
      { label: 'Εκτίμηση μηνιαίων αποδοχών', value: euro.format(monthlyEstimate), kind: 'warning' },
      { label: 'Δώρο Πάσχα', value: euro.format(easterGift) },
      { label: 'Επίδομα αδείας', value: euro.format(leaveAllowance) },
      { label: 'Δώρο Χριστουγέννων', value: euro.format(christmasGift) },
      { label: 'Ετήσια εκτίμηση', value: euro.format(annualEstimate), kind: 'total' },
      { label: 'Ωρομίσθιο', value: euro.format(hourly) },
    ],
    [
      'Από 1/4/2026 το κατώτατο ημερομίσθιο εργατοτεχνιτών είναι 41,09 ευρώ.',
      'Για ημερομίσθιους εφαρμόζεται 5% ανά τριετία έως 6 τριετίες.',
      'Οι μηνιαίες αποδοχές δεν μετατρέπονται αυτόματα σε μισθό. Υπολογίζονται από το ημερομίσθιο επί τις δηλωμένες πληρωτέες ημέρες.',
      'Τα πλήρη δώρα εμφανίζονται με βάση 15 ημερομίσθια για Πάσχα και 25 για Χριστούγεννα, με συντελεστή 1,04166666. Το επίδομα αδείας εμφανίζεται έως 13 ημερομίσθια.',
      'Η προϋπηρεσία αναγνωρίζεται για περιόδους πριν από 14/2/2012 και μετά από 1/1/2024, σύμφωνα με την τρέχουσα ενημέρωση του Υπουργείου Εργασίας.',
    ],
  )
}

function calculateSicknessPay() {
  const gross = value('gross')
  const sickDays = Math.max(0, value('sickDays'))
  const serviceYears = value('serviceYears')
  const usedEntitlement = Math.max(0, value('usedEntitlement'))
  const efkaDaily = Math.max(0, value('efkaDaily'))
  const waitingServed = q('waitingServed')?.checked
  const daily = gross / 25
  const annualEntitlement = serviceYears >= 1 ? 25 : 12.5
  const remainingEntitlement = Math.max(0, annualEntitlement - usedEntitlement)
  const employerCoveredDays = Math.min(sickDays, remainingEntitlement)
  const waitingDays = waitingServed ? 0 : Math.min(3, employerCoveredDays)
  const postWaitingEmployerDays = Math.max(0, employerCoveredDays - waitingDays)
  const efkaEligibleDays = waitingServed ? sickDays : Math.max(0, sickDays - 3)
  const firstPeriodEmployer = waitingDays * daily * 0.5
  const postPeriodEmployer = postWaitingEmployerDays * Math.max(0, daily - efkaDaily)
  const employerPay = firstPeriodEmployer + postPeriodEmployer
  const efkaPay = efkaEligibleDays * efkaDaily
  const totalPay = employerPay + efkaPay
  const uncoveredEmployerDays = Math.max(0, sickDays - employerCoveredDays)

  setResults(
    [
      { label: 'Σύνολο αποδοχών ασθενείας', value: euro.format(totalPay), kind: 'total' },
      { label: 'Καταβολή εργοδότη', value: euro.format(employerPay), kind: 'warning' },
      { label: 'Επίδομα ΕΦΚΑ', value: euro.format(efkaPay) },
      { label: 'Ημερήσιος μισθός', value: euro.format(daily) },
      { label: 'Ετήσιο δικαίωμα εργοδότη', value: `${number.format(annualEntitlement)} ημέρες` },
      { label: 'Υπόλοιπο δικαιώματος', value: `${number.format(remainingEntitlement)} ημέρες` },
      { label: 'Ημέρες χωρίς κάλυψη εργοδότη', value: `${number.format(uncoveredEmployerDays)} ημέρες` },
    ],
    [
      'Για τις πρώτες 3 ημέρες ασθένειας ο εργοδότης καταβάλλει το 1/2 του ημερήσιου μισθού, εφόσον υπάρχει υπόλοιπο ετήσιου δικαιώματος.',
      'Από την 4η ημέρα υπολογίζεται επίδομα ΕΦΚΑ. Ο εργοδότης καταβάλλει τη διαφορά μέχρι τον ημερήσιο μισθό για τις ημέρες που καλύπτονται από το ετήσιο δικαίωμα.',
      'Το ετήσιο δικαίωμα εργοδότη εμφανίζεται ενδεικτικά ως 12,5 ημέρες για υπηρεσία κάτω του έτους και 25 ημέρες για υπηρεσία ενός έτους και άνω.',
    ],
  )
}

const calculators = {
  salary: calculateSalary,
  severance: calculateSeverance,
  gifts: calculateGifts,
  overtime: calculateOvertime,
  leave: calculateLeave,
  minimumSalary: calculateMinimumSalary,
  minimumDaily: calculateMinimumDaily,
  sickness: calculateSicknessPay,
}

function wireCalculator() {
  const form = q('calculatorForm')
  if (!form) return
  const type = form.dataset.calculator
  const calculate = calculators[type]
  if (!calculate) return
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    calculate()
  })
  form.addEventListener('reset', () => {
    window.setTimeout(calculate, 0)
  })
  form.addEventListener('input', calculate)
  form.addEventListener('change', calculate)
  calculate()
}

function markActiveNav() {
  const page = document.body.dataset.page || 'index'
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('is-active', link.dataset.page === page)
  })
}

document.addEventListener('DOMContentLoaded', () => {
  markActiveNav()
  wireCalculator()
})
