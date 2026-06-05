import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const projectId = firebaseConfig.projectId;
const key = firebaseConfig.apiKey;
const dbId = firebaseConfig.firestoreDatabaseId;

async function testRead() {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/sharedNotes?key=${key}`;
  console.log(`Testing read from: ${url.replace(key, '***')}`);
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(`GET STATUS: ${res.status}`);
    console.log(`GET RESPONSE:`, JSON.stringify(data));
  } catch (error) {
    console.error("GET EXCEPTION:", error);
  }
}

testRead();
