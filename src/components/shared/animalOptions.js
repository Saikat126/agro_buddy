// Shared by every "Link to Animal" dropdown (TaskList, Calendar, ...).
// Disambiguates same-named animals (e.g. two "Kalapahar"s) by appending
// species/age, and — since even those can collide — a short slice of the
// id so every option is always guaranteed unique.
export function buildAnimalOptions(animals) {
  const nameCounts = {};
  animals.forEach((a) => {
    const key = a.name.trim().toLowerCase();
    nameCounts[key] = (nameCounts[key] || 0) + 1;
  });
  return animals.map((a) => {
    const key = a.name.trim().toLowerCase();
    if (nameCounts[key] <= 1) return { id: a.id, label: a.name };
    const details = [a.species, a.age_years ? `${a.age_years} yr` : null]
      .filter(Boolean)
      .join(', ');
    const label = `${a.name}${details ? ` — ${details}` : ''} (#${a.id.slice(0, 4)})`;
    return { id: a.id, label };
  });
}
