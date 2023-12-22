import type { UserType } from "../types/AuthTypes";
import type { EditUserType } from "../types/UserTypes";
import type { OutgoingDonationRequestType } from "../types/FormTypes";

// Returns URL of the backend based on production mode
const getBackEndUrl = () => {
  let backendUrl: string;

  if (import.meta.env.MODE === "production") {
    // Use the production server URL in production mode
    backendUrl = import.meta.env.VITE_PRODUCTION_SERVER_URL as string;
  } else {
    // Use the local server URL in development mode
    backendUrl = import.meta.env.VITE_LOCAL_SERVER_URL as string;
  }

  return backendUrl;
};

export const setUserType = async (uid: string, userType: string) => {
  return await fetch(`/api/sessions/v1/setUserType`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uid, userType }),
  });
};

export const registerUserOnServer = async (user: UserType) => {
  return await fetch(`/api/registration/v1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
};

export const getOrganizations = async (query?: string | undefined) => {
  let fetchURL = "";
  if (query === undefined) fetchURL = `/api/organization/v1`;
  else fetchURL = `/api/organization/v1?type=${query}`;

  const response = await fetch(fetchURL, {
    method: "GET",
    headers: {
      "Control-Cache": "no-cache",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to get organizations: ${response.status}`);
  }
  return await response.json();
};

export const getUserData = async (email: string, token: string | undefined) => {
  return await fetch(`/api/users/v1?email=${email}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
};

export const updateUser = async (
  email: string,
  userData: EditUserType,
  token: string | undefined,
) => {
  return await fetch(`/api/users/v1/update/${email}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(userData),
  });
};

export const getAllItems = async (token: string | undefined) => {
  const backendUrl = getBackEndUrl();
  return await fetch(`${backendUrl}/items/v1/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getItemByCategory = async (
  category: string,
  token: string | undefined,
) => {
  const backendUrl = getBackEndUrl();
  const fullUrl = `${backendUrl}/items/v1/?category=${category}`;

  return await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
};

export const createOutgoingDonation = async (
  token: string,
  request: OutgoingDonationRequestType,
) => {
  const backendUrl = getBackEndUrl();
  const fullUrl = `${backendUrl}/donation/createOutgoingDonation`;

  return await fetch(fullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });
};
