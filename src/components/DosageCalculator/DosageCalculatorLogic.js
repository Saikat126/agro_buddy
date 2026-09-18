// Pure math — no React, no Supabase, no side effects.
// Keeping this separate makes it trivial to unit test and reuse.


// Calculates how many milligrams and millilitres to give an animal.
// Formula: total_mg = weight × dose_rate, then total_ml = total_mg / concentration
// Example: a 450 kg cow needing 5 mg/kg of a 50 mg/ml drug → 45 ml
export function calculateDosage(weightKg, dosePerKg, concentration) {
  if (weightKg <= 0 || dosePerKg <= 0 || concentration <= 0) {
    return { totalMg: 0, totalMl: 0, warning: 'All values must be greater than zero.' };
  }

  const totalMg = weightKg * dosePerKg;
  const totalMl = totalMg / concentration;

  // Warn if the volume is unusually large — a single injection site shouldn't
  // typically take more than ~10 ml in livestock, so 50 ml is a clear red flag
  let warning = null;
  if (totalMl > 50) {
    warning = `Large volume (${totalMl.toFixed(2)} ml). Consider splitting into multiple sites.`;
  }

  return {
    totalMg: parseFloat(totalMg.toFixed(4)),
    totalMl: parseFloat(totalMl.toFixed(4)),
    warning,
  };
}


// Generates the list of dates when each dose should be given.
// Example: start today, every 2 days, for 10 days → [day 0, 2, 4, 6, 8, 10]
export function doseSchedule(startDate, frequencyDays, durationDays) {
  const schedule = [];
  let currentDate = new Date(startDate); // clone so we don't mutate the caller's date

  for (let day = 0; day <= durationDays; day += frequencyDays) {
    const doseDate = new Date(currentDate);
    doseDate.setDate(doseDate.getDate() + day); // JS handles month rollover automatically
    schedule.push(doseDate);
  }

  return schedule;
}


// Formats a Date object to something readable like "Mon, 14 May 2026".
export function formatDoseDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  });
}
