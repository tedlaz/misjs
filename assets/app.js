const config = window.PayrollConfig

const euro = new Intl.NumberFormat(config.locale.language, {
  style: 'currency',
  currency: config.locale.currency,
  minimumFractionDigits: 2,
})

const number = new Intl.NumberFormat(config.locale.language, {
  maximumFractionDigits: 2,
})

const calc = window.MisCalc

function q(id) {
  return document.getElementById(id)
}

function value(id, fallback = 0) {
  const el = q(id)
  if (!el) return fallback
  const parsed = Number(String(el.value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function renderResults(items, notes = []) {
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

function readSalaryForm() {
  const salaryConfig = config.salary
  return {
    gross: value('gross'),
    payments: value('payments', salaryConfig.defaultPayments),
    employeeRate: value('employeeRate', salaryConfig.defaultEmployeeRate * 100) / 100,
    employerRate: value('employerRate', salaryConfig.defaultEmployerRate * 100) / 100,
    cap: value('cap', salaryConfig.defaultContributionCap),
    children: value('children', salaryConfig.defaultChildren),
    age: value('age', salaryConfig.defaultAge),
  }
}

function updateSalaryCalculator() {
  const result = calc.computeSalary(readSalaryForm())
  renderResults(
    [
      { label: 'Καθαρό ανά πληρωμή', value: euro.format(result.net), kind: 'total' },
      { label: 'Κράτηση εργαζομένου', value: euro.format(result.employeeEfka) },
      { label: 'Φ.Μ.Υ. ανά πληρωμή', value: euro.format(result.withholding) },
      { label: 'Κόστος εργοδότη', value: euro.format(result.gross + result.employerEfka), kind: 'warning' },
    ],
    [
      `Ετήσιο φορολογητέο εισόδημα: ${euro.format(result.annualTaxable)}.`,
      `Ετήσιος φόρος μετά τη βασική μείωση: ${euro.format(result.annualTax)}.`,
      'Οι συντελεστές είναι προεπιλογές και μπορούν να αλλαχθούν από τη φόρμα.',
    ],
  )
}

function readSeveranceForm() {
  return {
    gross: value('gross'),
    years: value('years'),
    yearsAt2012: value('yearsAt2012'),
    status: q('status').value,
  }
}

function updateSeveranceCalculator() {
  const result = calc.computeSeverance(readSeveranceForm())
  renderResults(
    [
      { label: 'Συνολική αποζημίωση', value: euro.format(result.total), kind: 'total' },
      { label: 'Βασική αποζημίωση', value: euro.format(result.baseCompensation) },
      {
        label: 'Επιπλέον αποζημίωση',
        value: euro.format(result.additionalCompensation),
        kind: result.additionalCompensation ? 'warning' : '',
      },
      {
        label: 'Μήνες προειδοποίησης',
        value:
          result.status === 'notice'
            ? `${number.format(result.requiredNoticeMonths)} μήνες`
            : 'Δεν εφαρμόζεται',
      },
      {
        label: 'Δικαιούμενοι μήνες',
        value: `${number.format(result.entitlementMonths * result.factor)} μισθοί`,
      },
      {
        label: 'Μήνες επιπλέον κομματιού',
        value: `${result.status === 'pension' ? '0' : number.format(Math.max(0, result.entitlementMonths - 12) * result.factor)} μισθοί`,
      },
      { label: 'Αναγωγή μισθού σε 14/12', value: euro.format(result.grossWithSixth), kind: 'warning' },
      { label: 'Βάση βασικού κομματιού', value: euro.format(result.cappedBaseGross) },
      { label: 'Βάση βασικού με 14/12', value: euro.format(result.cappedBaseWithSixth) },
      { label: 'Βάση επιπλέον κομματιού', value: euro.format(result.cappedAdditionalGross) },
      { label: 'Βάση επιπλέον με 14/12', value: euro.format(result.cappedAdditionalWithSixth) },
    ],
    [
      'Ο πολλαπλασιασμός 14/12 ενσωματώνει το +1/6 στις τακτικές αποδοχές.',
      'Στο βασικό κομμάτι εφαρμόζεται πλαφόν μικτού μισθού 5.385,60 ευρώ.',
      'Στο επιπλέον κομμάτι εφαρμόζεται πλαφόν μικτού μισθού 1.714,286 ευρώ, δηλαδή 2.000 ευρώ μετά το 14/12.',
      'Στην επιλογή σύνταξης η Ergatiká υπολογίζει όλο το δικαίωμα με 40% και δεν εμφανίζει ξεχωριστό επιπλέον κομμάτι.',
    ],
  )
}

function readGiftsForm() {
  const giftsConfig = config.gifts
  return {
    gross: value('gross'),
    christmasDays: value('christmasDays', giftsConfig.christmasFullDays),
    easterDays: value('easterDays', giftsConfig.easterFullDays),
    leaveMonths: value('leaveMonths', giftsConfig.monthsPerYear),
  }
}

function updateGiftsCalculator() {
  const result = calc.computeGifts(readGiftsForm())
  renderResults(
    [
      { label: 'Δώρο Πάσχα', value: euro.format(result.easter), kind: 'total' },
      { label: 'Επίδομα άδειας', value: euro.format(result.leaveAllowance), kind: 'total' },
      { label: 'Δώρο Χριστουγέννων', value: euro.format(result.christmas), kind: 'total' },
    ],
    [
      'Τα δώρα προσαυξάνονται με 1,04166666 (1 + 1/24 αναλογία του επιδόματος άδειας).',
      'Διάστημα Δώρου Πάσχα 1/1-30/4.',
      'Διάστημα Δώρου Χριστουγέννων 1/5-31/12.',
    ],
  )
}

function readOvertimeForm() {
  return {
    gross: value('gross'),
    regularHours: value('regularHours', config.minimumWage.fullWeeklyHours),
  }
}

function updateOvertimeCalculator() {
  const result = calc.computeOvertime(readOvertimeForm())
  const output = q('results')
  if (!output) return
  output.innerHTML = `
    <div class="metric total">
      <span>Βασικό ωρομίσθιο</span>
      <strong>${euro.format(result.hourly)}</strong>
    </div>
    <div class="metric">
      <span>Ημερομίσθιο 8 ωρών</span>
      <strong>${euro.format(result.hourly * 8)}</strong>
    </div>
    <div class="table-wrap">
      <table class="rate-table">
        <thead>
          <tr>
            <th>Υπολογισμός</th>
            ${result.columns.map((column) => `<th>${column.label}<span>${column.note}</span></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${result.rows
            .map(
              (row) => `
            <tr>
              <td>${row.label}</td>
              ${row.amounts.map((amount) => `<td>${euro.format(amount)}</td>`).join('')}
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <ul class="breakdown">
      <li>Το ωρομίσθιο προκύπτει από μισθός / 25 * 6 / συμβατικές ώρες εβδομάδας. Δηλωμένο εβδομαδιαίο ωράριο: ${number.format(result.regularHours)} ώρες.</li>
      <li>Η υπερεργασία και η υπερωρία υπολογίζονται πάνω στο προσαυξημένο ωρομίσθιο της αντίστοιχης στήλης.</li>
    </ul>
  `
}

function readLeaveForm() {
  return {
    gross: value('gross'),
    schedule: q('schedule').value,
    yearsSame: value('yearsSame'),
    priorYears: value('yearsTotal'),
    monthsWorked: value('monthsWorked', config.leave.monthsPerYear),
  }
}

function updateLeaveCalculator() {
  const result = calc.computeLeave(readLeaveForm())
  renderResults(
    [
      {
        label: 'Ημέρες κανονικής άδειας (σε ετήσια βάση)',
        value: `${number.format(result.annualDays)} ημέρες`,
      },
      {
        label: 'Ημέρες κανονικής άδειας',
        value: `${number.format(result.leaveDaysDue)} ημέρες`,
        kind: 'total',
      },

      { label: 'Αποδοχές άδειας', value: euro.format(result.leavePay), kind: 'warning' },
      { label: 'Επίδομα αδείας', value: euro.format(result.leaveAllowance), kind: 'warning' },
      { label: 'Ημερομίσθιο', value: euro.format(result.daily) },
    ],
    [
      result.rule,
      `Συνολική προϋπηρεσία για τον έλεγχο 12ετίας: ${number.format(result.totalYears)} έτη.`,
      `Συντελεστής αποδοχών άδειας: ${number.format(result.leavePayFactor)} μισθοί. Συντελεστής επιδόματος αδείας: ${number.format(result.allowanceFactor)} μισθοί.`,
      'Για μερική απασχόληση, διαλείπουσα εργασία ή ειδική συλλογική σύμβαση χρειάζεται ξεχωριστή επιβεβαίωση.',
    ],
  )
}

function readMinimumSalaryForm() {
  return {
    hours: value('weeklyHours', config.minimumWage.fullWeeklyHours),
    triennials: value('triennials', 0),
    marriageAllowance: q('marriageAllowance')?.checked ? config.minimumWage.marriageAllowanceRate : 0,
  }
}

function updateMinimumSalaryCalculator() {
  const result = calc.computeMinimumSalary(readMinimumSalaryForm())
  renderResults(
    [
      { label: 'Κατώτατος μηνιαίος μισθός', value: euro.format(result.fullTimeAmount), kind: 'total' },
      { label: 'Βασικό ποσό 2026', value: euro.format(result.baseSalary) },
      { label: 'Προσαύξηση προϋπηρεσίας', value: `${number.format(result.increment * 100)}%` },
      { label: 'Επίδομα γάμου', value: result.marriageAllowance ? '10%' : 'Δεν εφαρμόζεται' },
      {
        label: 'Μηνιαίος μισθός με αναλογία ωραρίου',
        value: euro.format(result.proratedMonthly),
        kind: 'warning',
      },
      { label: 'Δώρο Πάσχα', value: euro.format(result.easterGift) },
      { label: 'Επίδομα αδείας', value: euro.format(result.leaveAllowance) },
      { label: 'Δώρο Χριστουγέννων', value: euro.format(result.christmasGift) },
      { label: 'Ετήσιο Ποσό', value: euro.format(result.annualAmount), kind: 'total' },
      { label: 'Ωρομίσθιο', value: euro.format(result.hourly) },
    ],
    [
      `Από 1/4/${config.minimumWage.year} ο κατώτατος μισθός πλήρους απασχόλησης είναι ${euro.format(config.minimumWage.salary.base)} και το κατώτατο ημερομίσθιο ${euro.format(config.minimumWage.daily.base)}.`,
      'Για μισθωτούς εφαρμόζεται 10% ανά τριετία έως 3 τριετίες.',
      'Αν επιλεγεί, το επίδομα γάμου προστίθεται ως επιπλέον 10% πάνω στο βασικό ποσό.',
      'Τα δώρα Πάσχα και Χριστουγέννων υπολογίζονται με συντελεστή 1,04166666. Το επίδομα αδείας υπολογίζεται ως μισό μηνιαίο ποσό.',
      'Η προϋπηρεσία αναγνωρίζεται για περιόδους πριν από 14/2/2012 και μετά από 1/1/2024, σύμφωνα με την τρέχουσα ενημέρωση του Υπουργείου Εργασίας.',
    ],
  )
}

function readMinimumDailyForm() {
  return {
    triennials: value('triennials', 0),
    weeklyHours: value('weeklyHours', config.minimumWage.fullWeeklyHours),
    weeklyDays: value('weeklyDays', config.minimumWage.daily.defaultWeeklyDays),
    paidDaysMonth: value('paidDaysMonth', config.minimumWage.daily.defaultPaidDaysMonth),
    marriageAllowance: q('marriageAllowance')?.checked ? config.minimumWage.marriageAllowanceRate : 0,
  }
}

function updateMinimumDailyCalculator() {
  const result = calc.computeMinimumDaily(readMinimumDailyForm())
  renderResults(
    [
      { label: 'Κατώτατο ημερομίσθιο', value: euro.format(result.daily), kind: 'total' },
      { label: 'Βασικό ημερομίσθιο 2026', value: euro.format(result.baseDaily) },
      { label: 'Προσαύξηση προϋπηρεσίας', value: `${number.format(result.increment * 100)}%` },
      { label: 'Επίδομα γάμου', value: result.marriageAllowance ? '10%' : 'Δεν εφαρμόζεται' },
      { label: 'Εκτίμηση εβδομαδιαίων αποδοχών', value: euro.format(result.weeklyEstimate), kind: 'warning' },
      { label: 'Εκτίμηση μηνιαίων αποδοχών', value: euro.format(result.monthlyEstimate), kind: 'warning' },
      { label: 'Δώρο Πάσχα', value: euro.format(result.easterGift) },
      { label: 'Επίδομα αδείας', value: euro.format(result.leaveAllowance) },
      { label: 'Δώρο Χριστουγέννων', value: euro.format(result.christmasGift) },
      { label: 'Ετήσια εκτίμηση', value: euro.format(result.annualEstimate), kind: 'total' },
      { label: 'Ωρομίσθιο', value: euro.format(result.hourly) },
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

function readSicknessForm() {
  return {
    gross: value('gross'),
    sickDays: Math.max(0, value('sickDays')),
    serviceYears: value('serviceYears'),
    usedEntitlement: Math.max(0, value('usedEntitlement')),
    efkaDaily: Math.max(0, value('efkaDaily')),
    waitingServed: q('waitingServed')?.checked,
  }
}

function updateSicknessCalculator() {
  const result = calc.computeSicknessPay(readSicknessForm())
  renderResults(
    [
      { label: 'Σύνολο αποδοχών ασθενείας', value: euro.format(result.totalPay), kind: 'total' },
      {
        label: `Μισές αποδοχές (${number.format(result.halfPayDays)} ημέρες)`,
        value: euro.format(result.halfPayEmployer),
      },
      {
        label: `Υπόλοιπες αποδοχές (${number.format(result.remainingEmployerDays)} ημέρες)`,
        value: euro.format(result.remainingEmployerPay),
      },
      { label: 'Καταβολή εργοδότη', value: euro.format(result.employerPay), kind: 'warning' },
      {
        label: `Επίδομα ΕΦΚΑ (${number.format(result.efkaEligibleDays)} ημέρες)`,
        value: euro.format(result.efkaPay),
      },
      { label: 'Ημερήσιος μισθός', value: euro.format(result.daily) },
      { label: 'Ετήσια υποχρέωση εργοδότη', value: `${number.format(result.annualEntitlement)} ημέρες` },
      {
        label: 'Υπόλοιπο πριν την τρέχουσα ασθένεια',
        value: `${number.format(result.remainingEntitlementBeforeSickness)} ημέρες`,
      },
      {
        label: 'Υπόλοιπο υποχρέωσης εργοδότη',
        value: `${number.format(result.remainingEntitlement)} ημέρες`,
      },
      {
        label: 'Ημέρες χωρίς κάλυψη εργοδότη',
        value: `${number.format(result.uncoveredEmployerDays)} ημέρες`,
      },
    ],
    [
      'Για τις ημέρες που πληρώνονται μισές, ο εργοδότης καταβάλλει το 1/2 του ημερήσιου μισθού, εφόσον υπάρχει υπόλοιπο ετήσιου δικαιώματος.',
      'Αν έχει ήδη καλυφθεί το 3ήμερο και η νέα ασθένεια είναι έως 3 ημέρες, δεν υπολογίζεται επίδομα ΕΦΚΑ και οι ημέρες εμφανίζονται στις μισές αποδοχές.',
      'Από την 4η ημέρα υπολογίζεται επίδομα ΕΦΚΑ. Ο εργοδότης καταβάλλει τη διαφορά μέχρι τον ημερήσιο μισθό για τις ημέρες που καλύπτονται από το ετήσιο δικαίωμα.',
      'Το ετήσιο δικαίωμα εργοδότη εμφανίζεται ενδεικτικά ως 12,5 ημέρες για υπηρεσία κάτω του έτους και 25 ημέρες για υπηρεσία ενός έτους και άνω.',
    ],
  )
}

const calculators = {
  salary: updateSalaryCalculator,
  severance: updateSeveranceCalculator,
  gifts: updateGiftsCalculator,
  overtime: updateOvertimeCalculator,
  leave: updateLeaveCalculator,
  minimumSalary: updateMinimumSalaryCalculator,
  minimumDaily: updateMinimumDailyCalculator,
  sickness: updateSicknessCalculator,
}

function wireCalculator() {
  const form = q('calculatorForm')
  if (!form) return
  const type = form.dataset.calculator
  const updateCalculator = calculators[type]
  if (!updateCalculator) return
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    updateCalculator()
  })
  form.addEventListener('reset', () => {
    window.setTimeout(updateCalculator, 0)
  })
  form.addEventListener('input', updateCalculator)
  form.addEventListener('change', updateCalculator)
  updateCalculator()
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
