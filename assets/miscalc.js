function clamp(valueToClamp, min, max) {
  return Math.min(Math.max(valueToClamp, min), max)
}

const payrollConfig = window.PayrollConfig

function findBandValue(bands, years, valueKey = 'months') {
  return bands.reduce((matched, band) => (years >= band.min ? band[valueKey] : matched), bands[0][valueKey])
}

function progressiveTax(income, children, age) {
  const taxConfig = payrollConfig.salary.tax
  const childBand = clamp(Math.floor(children), 0, taxConfig.credits.length - 1)
  const rates = [...taxConfig.childBands[childBand]]
  if (childBand === taxConfig.credits.length - 1) {
    rates[2] = Math.max(
      0,
      rates[2] - Math.max(children - (taxConfig.credits.length - 2), 0) * taxConfig.extraChildThirdBandReduction,
    )
  }
  if (age <= taxConfig.youngWorkerFirstThreshold) {
    rates[0] = 0
    rates[1] = 0
  } else if (age <= taxConfig.youngWorkerSecondThreshold) {
    rates[1] = children >= taxConfig.credits.length - 2 ? 0 : Math.min(rates[1], taxConfig.youngWorkerSecondRate)
  }
  const brackets = taxConfig.brackets
  let remaining = Math.max(0, income)
  let tax = 0
  for (let i = 0; i < brackets.length; i += 1) {
    const slice = Math.min(remaining, brackets[i])
    tax += slice * rates[i]
    remaining -= slice
    if (remaining <= 0) break
  }
  const lastCreditIndex = taxConfig.credits.length - 1
  const credits = [
    ...taxConfig.credits.slice(0, lastCreditIndex),
    taxConfig.credits[lastCreditIndex] + Math.max(0, children - lastCreditIndex) * taxConfig.extraChildCredit,
  ]
  let credit = credits[Math.min(children, lastCreditIndex)]
  if (income > taxConfig.creditReductionStart) {
    credit = Math.max(
      0,
      credit -
        Math.ceil((income - taxConfig.creditReductionStart) / taxConfig.creditReductionStep) *
          taxConfig.creditReductionAmount,
    )
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
  return findBandValue(payrollConfig.severance.serviceMonthBands, years)
}

function frozenSeveranceMonths(yearsAt2012) {
  return yearsAt2012 < payrollConfig.severance.frozenAdditionalBands[0].min
    ? 0
    : findBandValue(payrollConfig.severance.frozenAdditionalBands, yearsAt2012)
}

function noticeMonths(years) {
  return findBandValue(payrollConfig.severance.noticeBands, years)
}

function computeSeverance({ gross, years, yearsAt2012, status }) {
  const severanceConfig = payrollConfig.severance
  const baseMonths = severanceMonths(years)
  const additionalMonths = frozenSeveranceMonths(yearsAt2012)
  const frozenTotalMonths = additionalMonths > 0 ? severanceConfig.frozenBaseMonths + additionalMonths : 0
  const entitlementMonths = Math.max(baseMonths, frozenTotalMonths)
  const cappedBaseGross = Math.min(gross, severanceConfig.baseGrossCap)
  const cappedAdditionalGross = Math.min(gross, severanceConfig.additionalGrossCap)
  const sixthFactor = severanceConfig.regularPayFactor
  const grossWithSixth = gross * sixthFactor
  const cappedBaseWithSixth = cappedBaseGross * sixthFactor
  const cappedAdditionalWithSixth = cappedAdditionalGross * sixthFactor
  const requiredNoticeMonths = noticeMonths(years)
  let factor = 1
  if (status === 'notice') factor = severanceConfig.noticeFactor
  if (status === 'pension') factor = severanceConfig.pensionFactor

  let baseCompensation = 0
  let additionalCompensation = 0
  if (status === 'pension') {
    baseCompensation = cappedBaseGross * entitlementMonths * sixthFactor * factor
  } else if (entitlementMonths <= severanceConfig.frozenBaseMonths) {
    baseCompensation = cappedBaseGross * entitlementMonths * sixthFactor * factor
  } else {
    baseCompensation = cappedBaseGross * severanceConfig.frozenBaseMonths * sixthFactor * factor
    additionalCompensation =
      cappedAdditionalGross * (entitlementMonths - severanceConfig.frozenBaseMonths) * sixthFactor * factor
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
  const giftsConfig = payrollConfig.gifts
  const cappedChristmasDays = Math.min(christmasDays, giftsConfig.christmasFullDays)
  const cappedEasterDays = Math.min(easterDays, giftsConfig.easterFullDays)
  const cappedLeaveMonths = Math.min(leaveMonths, giftsConfig.monthsPerYear)
  const christmas = ((gross * cappedChristmasDays) / giftsConfig.christmasFullDays) * giftsConfig.factor
  const easter = ((gross * giftsConfig.halfMonth * cappedEasterDays) / giftsConfig.easterFullDays) * giftsConfig.factor
  const leaveAllowance = (gross * giftsConfig.halfMonth * cappedLeaveMonths) / giftsConfig.monthsPerYear
  return { christmas, easter, leaveAllowance }
}

function computeOvertime({ gross, regularHours }) {
  const overtimeConfig = payrollConfig.overtime
  const hourly =
    regularHours > 0
      ? ((gross / overtimeConfig.monthlyWorkDays) * overtimeConfig.weekConversionDays) / regularHours
      : 0
  const columns = overtimeConfig.columns
  const rows = overtimeConfig.rows.map((row) => ({
    ...row,
    amounts: columns.map((column) =>
      row.mode === 'premium' ? hourly * (column.multiplier - 1) : hourly * column.multiplier * row.factor,
    ),
  }))
  return { regularHours, hourly, columns, rows }
}

function leaveDays(schedule, yearsSame, priorYears) {
  const leaveConfig = payrollConfig.leave
  const sixDay = schedule === '6'
  const totalYears = yearsSame + priorYears
  if (totalYears >= leaveConfig.seniorTotalYears || yearsSame >= leaveConfig.seniorSameEmployerYears) {
    return sixDay ? leaveConfig.seniorDays.sixDay : leaveConfig.seniorDays.fiveDay
  }
  if (yearsSame < leaveConfig.firstYearLimit) {
    return sixDay ? leaveConfig.firstYearDays.sixDay : leaveConfig.firstYearDays.fiveDay
  }
  if (yearsSame < leaveConfig.secondYearLimit) {
    return sixDay ? leaveConfig.secondYearDays.sixDay : leaveConfig.secondYearDays.fiveDay
  }
  return sixDay ? leaveConfig.standardDays.sixDay : leaveConfig.standardDays.fiveDay
}

function computeLeave({ gross, schedule, yearsSame, priorYears, monthsWorked }) {
  const leaveConfig = payrollConfig.leave
  const cappedMonthsWorked = clamp(monthsWorked, 0, leaveConfig.monthsPerYear)
  const monthsRatio = cappedMonthsWorked / leaveConfig.monthsPerYear
  const totalYears = yearsSame + priorYears
  const annualDays = leaveDays(schedule, yearsSame, priorYears)
  const isSixDay = schedule === '6'
  const isFirstYear = yearsSame < leaveConfig.firstYearLimit
  const hasSeniorLeave = yearsSame >= leaveConfig.seniorSameEmployerYears || totalYears >= leaveConfig.seniorTotalYears
  const leaveDaysDue = Math.round(isFirstYear ? annualDays * monthsRatio : annualDays)
  const daily = gross / leaveConfig.monthlyWorkDays
  let leavePayFactor = leaveConfig.standardPayFactor
  let allowanceFactor = leaveConfig.allowanceMaxFactor
  let rule = ''

  if (isFirstYear) {
    leavePayFactor = monthsRatio * (leaveConfig.firstYearPayNumerator / leaveConfig.monthlyWorkDays)
    allowanceFactor = Math.min(leavePayFactor, leaveConfig.allowanceMaxFactor)
    rule = isSixDay
      ? 'Πρώτο έτος εξαήμερης εργασίας: 24 / 12 x μήνες εργασίας ημέρες άδειας.'
      : 'Πρώτο έτος πενθήμερης εργασίας: 20 / 12 x μήνες εργασίας ημέρες άδειας.'
  } else if (hasSeniorLeave) {
    leavePayFactor = leaveConfig.seniorDays.sixDay / leaveConfig.monthlyWorkDays
    allowanceFactor = leaveConfig.allowanceMaxFactor
    rule = isSixDay
      ? 'Με 10 έτη στον ίδιο εργοδότη ή 12 έτη συνολικά: 30 ημέρες άδειας σε εξαήμερη εργασία.'
      : 'Με 10 έτη στον ίδιο εργοδότη ή 12 έτη συνολικά: 25 ημέρες άδειας σε πενθήμερη εργασία.'
  } else if (yearsSame < leaveConfig.secondYearLimit) {
    leavePayFactor = leaveConfig.standardPayFactor
    allowanceFactor = leaveConfig.allowanceMaxFactor
    rule = isSixDay
      ? 'Δεύτερο έτος εξαήμερης εργασίας: 25 ημέρες άδειας.'
      : 'Δεύτερο έτος πενθήμερης εργασίας: 21 ημέρες άδειας.'
  } else {
    leavePayFactor = leaveConfig.standardPayFactor
    allowanceFactor = leaveConfig.allowanceMaxFactor
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
  const minimumConfig = payrollConfig.minimumWage
  const salaryConfig = minimumConfig.salary
  const giftsConfig = payrollConfig.gifts
  const baseSalary = salaryConfig.base
  const appliedTriennials = clamp(Math.floor(triennials), 0, salaryConfig.maxTriennials)
  const increment = appliedTriennials * salaryConfig.triennialRate
  const fullTimeAmount = baseSalary * (1 + increment + marriageAllowance)
  const hoursRatio = hours > 0 ? Math.min(hours / minimumConfig.fullWeeklyHours, 1) : 0
  const proratedMonthly = fullTimeAmount * hoursRatio
  const easterGift = proratedMonthly * giftsConfig.halfMonth * giftsConfig.factor
  const leaveAllowance = proratedMonthly * giftsConfig.halfMonth
  const christmasGift = proratedMonthly * giftsConfig.factor
  const annualAmount = proratedMonthly * giftsConfig.monthsPerYear + easterGift + leaveAllowance + christmasGift
  const hourly =
    hours > 0
      ? ((fullTimeAmount / salaryConfig.monthlyWorkDays) * salaryConfig.weekConversionDays) / minimumConfig.fullWeeklyHours
      : 0
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
  const minimumConfig = payrollConfig.minimumWage
  const dailyConfig = minimumConfig.daily
  const giftsConfig = payrollConfig.gifts
  const baseDaily = dailyConfig.base
  const appliedTriennials = clamp(Math.floor(triennials), 0, dailyConfig.maxTriennials)
  const increment = appliedTriennials * dailyConfig.triennialRate
  const daily = baseDaily * (1 + increment + marriageAllowance)
  const monthlyEstimate = daily * Math.max(0, paidDaysMonth)
  const weeklyEstimate = daily * Math.max(0, weeklyDays)
  const easterGift = daily * dailyConfig.easterGiftDays * giftsConfig.factor
  const leaveAllowance = daily * dailyConfig.leaveAllowanceDays
  const christmasGift = daily * dailyConfig.christmasGiftDays * giftsConfig.factor
  const annualEstimate = monthlyEstimate * giftsConfig.monthsPerYear + easterGift + leaveAllowance + christmasGift
  const hourly = weeklyHours > 0 ? (daily * dailyConfig.defaultWeeklyDays) / weeklyHours : 0
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
  const sicknessConfig = payrollConfig.sickness
  const daily = gross / sicknessConfig.monthlyWorkDays
  const annualEntitlement =
    serviceYears >= sicknessConfig.seniorServiceYears
      ? sicknessConfig.entitlementAfterOneYear
      : sicknessConfig.entitlementBeforeOneYear
  const remainingEntitlementBeforeSickness = Math.max(0, annualEntitlement - usedEntitlement)
  const employerCoveredDays = Math.min(sickDays, remainingEntitlementBeforeSickness)
  const remainingEntitlement = Math.max(0, remainingEntitlementBeforeSickness - employerCoveredDays)
  const shortCoveredWaitingCase = waitingServed && sickDays <= sicknessConfig.waitingDays
  const halfPayDays = shortCoveredWaitingCase
    ? employerCoveredDays
    : Math.min(waitingServed ? 0 : sicknessConfig.waitingDays, employerCoveredDays)
  const remainingEmployerDays = Math.max(0, employerCoveredDays - halfPayDays)
  const efkaEligibleDays = shortCoveredWaitingCase
    ? 0
    : waitingServed
      ? sickDays
      : Math.max(0, sickDays - sicknessConfig.waitingDays)
  const halfPayEmployer = halfPayDays * daily * sicknessConfig.firstPeriodEmployerRate
  const remainingEmployerPay = remainingEmployerDays * Math.max(0, daily - efkaDaily)
  const employerPay = halfPayEmployer + remainingEmployerPay
  const efkaPay = efkaEligibleDays * efkaDaily
  const uncoveredEmployerDays = Math.max(0, sickDays - employerCoveredDays)
  return {
    daily,
    annualEntitlement,
    remainingEntitlementBeforeSickness,
    remainingEntitlement,
    halfPayDays,
    halfPayEmployer,
    remainingEmployerDays,
    remainingEmployerPay,
    efkaEligibleDays,
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
