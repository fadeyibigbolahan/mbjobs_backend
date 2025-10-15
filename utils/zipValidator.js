// utils/zipValidator.js
import fetch from "node-fetch";

const ALLOWED_COUNTIES = new Set([
  "48015",
  "48039",
  "48071",
  "48089",
  "48157",
  "48167",
  "48201",
  "48291",
  "48321",
  "48339",
  "48471",
  "48473",
  "48481",
]);

export async function validateZipCode(zip) {
  const zipCode = String(zip || "").trim();

  // Validate ZIP format
  if (!/^\d{5}$/.test(zipCode)) {
    return {
      isValid: false,
      inRegion: false,
      reason: "invalid_zip_format",
    };
  }

  try {
    // Step 1: Convert ZIP to coordinates
    const zipResponse = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
    if (!zipResponse.ok) {
      return {
        isValid: false,
        inRegion: false,
        reason: "zip_lookup_failed",
      };
    }

    const zipData = await zipResponse.json();
    if (!zipData?.places?.length) {
      return {
        isValid: false,
        inRegion: false,
        reason: "zip_not_found",
      };
    }

    const { latitude, longitude } = zipData.places[0];

    // Step 2: Convert coordinates to county FIPS
    const fccResponse = await fetch(
      `https://geo.fcc.gov/api/census/block/find?latitude=${latitude}&longitude=${longitude}&showall=true&format=json`
    );

    if (!fccResponse.ok) {
      return {
        isValid: false,
        inRegion: false,
        reason: "county_lookup_failed",
      };
    }

    const countyData = await fccResponse.json();
    const fipsCode = countyData?.County?.FIPS?.slice(0, 5);
    const countyName = countyData?.County?.name;

    if (!fipsCode) {
      return {
        isValid: false,
        inRegion: false,
        reason: "county_not_found",
      };
    }

    // Step 3: Check if county is in allowed region
    const inRegion = ALLOWED_COUNTIES.has(fipsCode);

    return {
      isValid: true,
      inRegion,
      fips: fipsCode,
      countyName,
      zip: zipCode,
    };
  } catch (error) {
    console.error("ZIP validation error:", error);
    return {
      isValid: false,
      inRegion: false,
      reason: "validation_error",
    };
  }
}
