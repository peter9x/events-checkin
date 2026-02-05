import React, { createContext, useContext, useMemo, useState } from "react";

export type RegistrationResource = {
  id: string;
  athlete: AthleteDetail;
  event: EventResource;
  course: CourseResource;
  category: {
    id: string;
    name: string;
    code: string;
  };
  team: {
    name: string;
  };
  extras?: RegistrationExtra[];
  status: string;
  check_in: boolean;
  bib_number: number | null;
  allow_check_in: boolean;
  registered_on: string | null;
  registered_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export interface CountrySummary {
  id: string | number;
  name: string;
  iso?: string;
}

export type GenderOption = "male" | "female" | "other";

export interface UserLinkedInfo {
  id: string;
  email: string;
}

export interface AthleteDetail {
  id: string;
  name: string;
  firstname?: string;
  lastname?: string;
  user: UserLinkedInfo;
  identification_number: string;
  country: CountrySummary | null;
  nationality?: CountrySummary | null;
  avatar?: string;
  active?: boolean;
  birth_date: string;
  email: string;
  gender: GenderOption | null;
  country_id: string | number | null;
  nationality_id: string | number | null;
  vat_number: string;
}

export interface EventResource {
  id: string;
  name: string;
  description: string;
  location: string;
  date_resume: string;
  courses_count: number;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  courses?: CourseResource[];
}

export type CourseResource = {
  id: string;
  name: string;
  distance: string;
};

export type RegistrationExtra = {
  id?: string;
  value: string;
  type: string;
  status?: string;
};

type CheckinContextValue = {
  registration: RegistrationResource | null;
  setRegistration: (registration: RegistrationResource | null) => void;
};

const CheckinContext = createContext<CheckinContextValue | undefined>(undefined);

export function CheckinProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = useState<RegistrationResource | null>(
    null
  );

  const value = useMemo(
    () => ({
      registration,
      setRegistration,
    }),
    [registration]
  );

  return (
    <CheckinContext.Provider value={value}>
      {children}
    </CheckinContext.Provider>
  );
}

export function useCheckin() {
  const context = useContext(CheckinContext);
  if (!context) {
    throw new Error("useCheckin must be used within CheckinProvider");
  }
  return context;
}
