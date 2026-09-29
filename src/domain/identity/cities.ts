// Static per-country city suggestions for onboarding's city <datalist> (F-01: "free text
// allowed", this is a helper, not a closed list). Pilot scope only (D-001: AE/IN).
export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  AE: [
    'Dubai',
    'Abu Dhabi',
    'Sharjah',
    'Ajman',
    'Al Ain',
    'Ras Al Khaimah',
    'Fujairah',
    'Umm Al Quwain',
  ],
  IN: [
    'Mumbai',
    'Delhi',
    'Bengaluru',
    'Hyderabad',
    'Chennai',
    'Kolkata',
    'Pune',
    'Ahmedabad',
    'Jaipur',
    'Surat',
    'Lucknow',
    'Chandigarh',
  ],
};
