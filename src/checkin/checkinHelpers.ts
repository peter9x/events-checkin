import {
  RecentCheckin,
  RegistrationResource,
} from "./CheckinContext";

export type SearchParam = "bib_number" | "identification_number" | "code";

type SearchQueries = Record<SearchParam, string>;

const SEARCH_FIELD_ORDER: SearchParam[] = [
  "bib_number",
  "identification_number",
  "code",
];

export const resolveSearchCriteria = (
  queries: SearchQueries,
  activeParam: SearchParam,
) => {
  const selectedParam =
    SEARCH_FIELD_ORDER.find((field) => queries[field].trim()) ?? activeParam;

  return {
    searchParam: selectedParam,
    trimmedQuery: queries[selectedParam].trim(),
  };
};

export const getRegistrationAthleteName = (
  registration: RegistrationResource,
) => {
  const athlete = registration.athlete;

  return (
    athlete?.name ||
    [athlete?.firstname, athlete?.lastname].filter(Boolean).join(" ") ||
    "Atleta"
  );
};

export const buildRecentCheckin = (
  registration: RegistrationResource,
  createdAt = Date.now(),
): RecentCheckin => {
  const shirtExtra = registration.extras?.find(
    (extra) => extra.type === "shirt" && extra.value,
  );
  const athleteName =
    [registration.athlete.firstname, registration.athlete.lastname]
      .filter(Boolean)
      .join(" ")
      .trim() || registration.athlete.name;

  return {
    id: `${registration.id}-${createdAt}`,
    athleteName: athleteName || "—",
    bibNumber: registration.bib_number ?? null,
    shirt: shirtExtra?.value ?? null,
    box: registration.box?.name ?? null,
    createdAt,
  };
};
