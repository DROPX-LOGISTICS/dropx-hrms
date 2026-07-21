export const COUNTRY_CODE_OPTIONS = [
  { value: "91", label: "+91 India" },
  { value: "971", label: "+971 UAE" },
  { value: "966", label: "+966 Saudi Arabia" },
  { value: "974", label: "+974 Qatar" },
  { value: "965", label: "+965 Kuwait" },
  { value: "968", label: "+968 Oman" },
  { value: "973", label: "+973 Bahrain" },
  { value: "1", label: "+1 USA / Canada" },
  { value: "44", label: "+44 United Kingdom" },
  { value: "61", label: "+61 Australia" },
  { value: "65", label: "+65 Singapore" },
  { value: "60", label: "+60 Malaysia" }
] as const;

export function cleanCountryCode(value: string) {
  return value.replace(/\D/g, "") || "91";
}
