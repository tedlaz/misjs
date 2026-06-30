function clamp(valueToClamp, min, max) {
  return Math.min(Math.max(valueToClamp, min), max)
}

function progressiveTax(income, children, age) {
  const childBand = clamp(children, 0, 5)
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

function computeSalary({ gross, payments, employeeRate, employerRate, cap, children, age }) {
  const monthlyBase = Math.min(gross, cap)
  const employeeEfka = monthlyBase * employeeRate
  const employerEfka = monthlyBase * employerRate
  const annualTaxable = Math.max(0, gross * payments - employeeEfka * payments)
  const annualTax = progressiveTax(annualTaxable, children, age)
  const withholding = annualTax / payments
  const net = gross - employeeEfka - withholding
  return { gross, employeeEfka, employerEfka, annualTaxable, annualTax, withholding, net }
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

function computeSeverance({ gross, years, yearsAt2012, status }) {
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

  return {
    status,
    factor,
    entitlementMonths,
    requiredNoticeMonths,
    grossWithSixth,
    cappedBaseGross,
    cappedBaseWithSixth,
    cappedAdditionalGross,
    cappedAdditionalWithSixth,
    baseCompensation,
    additionalCompensation,
    total: baseCompensation + additionalCompensation,
  }
}

function computeGifts({ gross, christmasDays, easterDays, leaveMonths }) {
  const giftFactor = 1.04166666
  const cappedChristmasDays = Math.min(christmasDays, 245)
  const cappedEasterDays = Math.min(easterDays, 120)
  const cappedLeaveMonths = Math.min(leaveMonths, 12)
  const christmas = ((gross * cappedChristmasDays) / 245) * giftFactor
  const easter = ((gross * 0.5 * cappedEasterDays) / 120) * giftFactor
  const leaveAllowance = (gross * 0.5 * cappedLeaveMonths) / 12
  return { christmas, easter, leaveAllowance }
}

function computeOvertime({ gross, regularHours }) {
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
  ].map((row) => ({
    ...row,
    amounts: columns.map((column) =>
      row.mode === 'premium' ? hourly * (column.multiplier - 1) : hourly * column.multiplier * row.factor,
    ),
  }))
  return { regularHours, hourly, columns, rows }
}

function leaveDays(schedule, yearsSame, priorYears) {
  const sixDay = schedule === '6'
  const totalYears = yearsSame + priorYears
  if (totalYears >= 12) return sixDay ? 30 : 25
  if (yearsSame >= 10) return sixDay ? 30 : 25
  if (yearsSame < 1) return sixDay ? 24 : 20
  if (yearsSame < 2) return sixDay ? 25 : 21
  return sixDay ? 26 : 22
}

function computeLeave({ gross, schedule, yearsSame, priorYears, monthsWorked }) {
  const cappedMonthsWorked = clamp(monthsWorked, 0, 12)
  const monthsRatio = cappedMonthsWorked / 12
  const totalYears = yearsSame + priorYears
  const annualDays = leaveDays(schedule, yearsSame, priorYears)
  const isSixDay = schedule === '6'
  const isFirstYear = yearsSame < 1
  const hasSeniorLeave = yearsSame >= 10 || totalYears >= 12
  const leaveDaysDue = Math.round(isFirstYear ? annualDays * monthsRatio : annualDays)
  const daily = gross / 25
  let leavePayFactor = 1
  let allowanceFactor = 0.5
  let rule = ''

  if (isFirstYear) {
    leavePayFactor = monthsRatio * (24 / 25)
    allowanceFactor = Math.min(leavePayFactor, 0.5)
    rule = isSixDay
      ? 'Πρώτο έτος εξαήμερης εργασίας: 24 / 12 x μήνες εργασίας ημέρες άδειας.'
      : 'Πρώτο έτος πενθήμερης εργασίας: 20 / 12 x μήνες εργασίας ημέρες άδειας.'
  } else if (hasSeniorLeave) {
    leavePayFactor = 30 / 25
    allowanceFactor = 0.5
    rule = isSixDay
      ? 'Με 10 έτη στον ίδιο εργοδότη ή 12 έτη συνολικά: 30 ημέρες άδειας σε εξαήμερη εργασία.'
      : 'Με 10 έτη στον ίδιο εργοδότη ή 12 έτη συνολικά: 25 ημέρες άδειας σε πενθήμερη εργασία.'
  } else if (yearsSame < 2) {
    leavePayFactor = 1
    allowanceFactor = 0.5
    rule = isSixDay
      ? 'Δεύτερο έτος εξαήμερης εργασίας: 25 ημέρες άδειας.'
      : 'Δεύτερο έτος πενθήμερης εργασίας: 21 ημέρες άδειας.'
  } else {
    leavePayFactor = 1
    allowanceFactor = 0.5
    rule = isSixDay
      ? 'Τρίτο έτος και μετά σε εξαήμερη εργασία: 26 ημέρες άδειας.'
      : 'Τρίτο έτος και μετά σε πενθήμερη εργασία: 22 ημέρες άδειας.'
  }

  return {
    totalYears,
    annualDays,
    leaveDaysDue,
    daily,
    leavePay: gross * leavePayFactor,
    leaveAllowance: gross * allowanceFactor,
    leavePayFactor,
    allowanceFactor,
    rule,
  }
}

function computeMinimumSalary({ hours, triennials, marriageAllowance }) {
  const baseSalary = 920
  const appliedTriennials = clamp(Math.floor(triennials), 0, 3)
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
  return {
    baseSalary,
    increment,
    marriageAllowance,
    fullTimeAmount,
    proratedMonthly,
    easterGift,
    leaveAllowance,
    christmasGift,
    annualAmount,
    hourly,
  }
}

function computeMinimumDaily({ triennials, weeklyHours, weeklyDays, paidDaysMonth, marriageAllowance }) {
  const baseDaily = 41.09
  const appliedTriennials = clamp(Math.floor(triennials), 0, 6)
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
  return {
    baseDaily,
    increment,
    marriageAllowance,
    daily,
    monthlyEstimate,
    weeklyEstimate,
    easterGift,
    leaveAllowance,
    christmasGift,
    annualEstimate,
    hourly,
  }
}

function computeSicknessPay({ gross, sickDays, serviceYears, usedEntitlement, efkaDaily, waitingServed }) {
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
  const uncoveredEmployerDays = Math.max(0, sickDays - employerCoveredDays)
  return {
    daily,
    annualEntitlement,
    remainingEntitlement,
    employerPay,
    efkaPay,
    totalPay: employerPay + efkaPay,
    uncoveredEmployerDays,
  }
}

window.MisCalc = {
  clamp,
  progressiveTax,
  severanceMonths,
  frozenSeveranceMonths,
  noticeMonths,
  leaveDays,
  computeSalary,
  computeSeverance,
  computeGifts,
  computeOvertime,
  computeLeave,
  computeMinimumSalary,
  computeMinimumDaily,
  computeSicknessPay,
}
