import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const projectId = firebaseConfig.projectId;
const dbId = firebaseConfig.firestoreDatabaseId;

async function getAccessToken() {
  const url = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
  const res = await fetch(url, {
    headers: { 'Metadata-Flavor': 'Google' }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch metadata token: ${res.statusText}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function deploy() {
  try {
    console.log("Fetching GCP Service Account Access Token...");
    const token = await getAccessToken();
    console.log("Successfully obtained Access Token.");

    const rulesContent = fs.readFileSync('./firestore.rules', 'utf8');
    
    // Step 1: Create Ruleset
    const rulesetUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`;
    console.log(`Creating Ruleset for ${projectId}...`);
    const rulesetRes = await fetch(rulesetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: {
          files: [
            {
              name: 'firestore.rules',
              content: rulesContent
            }
          ]
        }
      })
    });
    
    const rulesetData = await rulesetRes.json();
    if (!rulesetRes.ok) {
      throw new Error(`Ruleset creation failed: ${JSON.stringify(rulesetData)}`);
    }
    const rulesetName = rulesetData.name;
    console.log(`Ruleset created successfully: ${rulesetName}`);

    // Step 2: Release the Ruleset to the specific Database instance
    // Note: The release name format for non-default database is "cloud.firestore/DATABASE_ID"
    const releaseName = `cloud.firestore/${dbId}`;
    const escapedReleaseName = encodeURIComponent(releaseName);
    const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/${escapedReleaseName}`;
    
    console.log(`Updating release ${releaseName}...`);
    const releaseRes = await fetch(releaseUrl, {
      method: 'PUT', // PUT / PATCH is used to create or update a release
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        release: {
          name: `projects/${projectId}/releases/${releaseName}`,
          rulesetName: rulesetName
        }
      })
    });
    
    const releaseData = await releaseRes.json();
    if (!releaseRes.ok) {
      throw new Error(`Release failed: ${JSON.stringify(releaseData)}`);
    }
    console.log(`SUCCESS! Ruleset successfully released to ${releaseName}!`);
  } catch (error) {
    console.error("DEPLOY EXCEPTION:", error);
  }
}

deploy();
