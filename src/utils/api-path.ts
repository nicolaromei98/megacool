import { getValidatedUrlSafe } from "./url-validator";

const basePath = "/api/";
const useSSL = true;

const isDev = process.env.NODE_ENV === "development";

export const apiPath = (route: string = "") => {
  // In development
  if (isDev) {
    return `${useSSL ? "https" : "http"}://localhost:6546${basePath}${route}`;
  }

  // Use validated URL
  const vercelUrl = getValidatedUrlSafe("VERCEL_URL");
  if (!vercelUrl) {
    throw new Error(
      "VERCEL_URL is not set or invalid. Please set a valid URL in your environment variables."
    );
  }

  return `${vercelUrl}${basePath}${route}`;
};
