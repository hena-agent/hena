import type { MutableRegistrations } from "./extension";

export const assertRegistrationOpen = (
  registrations: MutableRegistrations,
): void => {
  if (!registrations.isOpen()) {
    throw new Error("Extension registration is closed");
  }
};
