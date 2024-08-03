import { gmail_v1, google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { WebClient as SlackWebClient } from '@slack/web-api';
import { Storage } from '@google-cloud/storage';
import assert from 'assert';

let slack: SlackWebClient | undefined;

export function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value !== undefined) {
    return value;
  }
  else if (defaultValue !== undefined) {
    return defaultValue;
  }
  else {
    throw new Error(`Environment variable ${name} is not set and no default value was provided.`);
  }
}

export async function getGmailClient(): Promise<gmail_v1.Gmail> {
  try {
    const authClient = await getAuthClient(
      getEnv('SERVICE_ACCOUNT_GMAIL'),
      getEnv('GMAIL_USER'),
      ['https://www.googleapis.com/auth/gmail.modify']
    );
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    assert(gmail && gmail instanceof gmail_v1.Gmail);
    return gmail;
  }
  catch(error) {
    console.log(['Error getting Gmail client', error]);
    throw new Error('Error getting Gmail client');
  }
}

export async function getAuthClient(keyFile: string, gmailUser: string, authScopes: string[]): Promise<any> {
  try {
    const auth = new GoogleAuth({
      keyFile: `service-accounts/${keyFile}`,
      scopes: authScopes,
      clientOptions: {
        subject: gmailUser,
      }
    });
    return await auth.getClient();
  }
  catch (error) {
    console.log([`Error getting Google Auth client for ${gmailUser}:`, error]);
  }
}

export async function getBucket(bucketName: string): Promise<any> {
  const keyFile: string = getEnv('SERVICE_ACCOUNT_WAREHOUSE');
  try {
    const storage = new Storage({
      projectId: getEnv('BUCKET_PROJECT'),
      keyFilename: `service-accounts/${keyFile}`
    });
    const bucket = storage.bucket(bucketName);
    return bucket;
  }
  catch (error) {
    console.log([`Error get the bucket ${bucketName}:`, error]);
  }
}

export async function socialiseIt(message: string): Promise<any> {
  try {
    if (!slack) {
      slack = new SlackWebClient(); // Initialize WebClient
    }
    const result = await slack.chat.postMessage({
      text: message,
      channel: getEnv('SLACK_CHANNEL'),
    });
  }
  catch (error) {
    console.log(error);
  }
}


// import { Base64 } from 'js-base64';

// export function decodeBase64(str: string): string {
//   str = str.replace(/_/g, '/').replace(/-/g, '+'); // important line
//   return Base64.atob(str);
// }


