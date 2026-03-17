export type LoginResponsePayload = {
  user_id?: string | number;
  user_name?: string;
  staff: {
    id?: string | number;
    name?: string;
  };
  event: {
    id?: string | number;
    name?: string;
  };
  token?: string;
  expires_in?: unknown;
};
