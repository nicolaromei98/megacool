import { getValidatedUrlSafe } from "../src/utils/url-validator";

async function deploy() {
  if (!process.env.VERCEL_DEPLOY_HOOK) {
    console.log("VERCEL_DEPLOY_HOOK is not set. Set it in the .env file");
    return;
  }

  const res = await fetch(process.env.VERCEL_DEPLOY_HOOK!, {
    method: "POST",
  });

  if (!res.ok) {
    console.log("Deploy failed ;(");
  }

  const data = await res.json();
  console.log(data);

  // Use the new URL validation
  const vercelUrl = getValidatedUrlSafe("VERCEL_URL");
  if (vercelUrl) {
    console.log(`\nDeployment URL: ${vercelUrl}`);
    console.log("Check the build progress at the URL above");
  } else {
    console.log(
      "\n⚠️  VERCEL_URL is not set or invalid. Set a valid URL in your .env file"
    );
  }
}

deploy();
