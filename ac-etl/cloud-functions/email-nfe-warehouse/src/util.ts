import { gmail_v1, google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { WebClient as SlackWebClient } from '@slack/web-api';
import { Storage } from '@google-cloud/storage';
import assert from 'assert';

type GmailListMessagesResponse = gmail_v1.Schema$ListMessagesResponse;
type GmailMessage = gmail_v1.Schema$Message;

let slack: SlackWebClient | undefined;
let gmail: gmail_v1.Gmail | undefined;

function isGmailListMessages(data: any): data is GmailListMessagesResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data.messages === undefined || Array.isArray(data.messages) && data.messages.every((message: { id: string; threadId: string; }) =>
      typeof message.id === 'string' && typeof message.threadId === 'string')) &&
    (data.nextPageToken === undefined || typeof data.nextPageToken === 'string') &&
    (data.resultSizeEstimate === undefined || typeof data.resultSizeEstimate === 'number')
  );
}

function isGmailMessage(data: any): data is GmailMessage {
  return typeof data === 'object' &&
    data !== null &&
    typeof data.id === 'string' &&
    typeof data.snippet === 'string' &&
    typeof data.threadId === 'string';
}

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

async function getAuthClient(keyFile: string, gmailUser: string, authScopes: string[]): Promise<any> {
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

export async function getGmailClient(): Promise<gmail_v1.Gmail> {
  if (gmail != undefined) {
    return gmail;
  }
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

export async function getBucket(bucketName: string): Promise<any> {
  const keyFile: string = getEnv('SERVICE_ACCOUNT_WAREHOUSE');
  try {
    const storage = new Storage({
      projectId: getEnv('WAREHOUSE_PROJECT'),
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

export async function getMessages(query: string = '', label: string): Promise<GmailMessage[]> {
  try {
    const gmail = await getGmailClient();
    const res = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [label],
      q: query,
    });
    assert(isGmailListMessages(res.data) == true);
    // We deal with a small volume of messages, usually there will only
    // be one. But this should be batched rather than loading one by one.
    const messagePromises = res.data.messages?.map(async (message) => {
      assert(message.id != undefined);
      const res = await gmail.users.messages.get({
        id: message.id,
        userId: 'me',
      });
      // Not quite prepared to assert on this yet.
      if (!isGmailMessage(res.data)) {
        console.log(['Is there a gmail message in this response?', res]);
      }
      return res.data;
    }) || [];
    return await Promise.all(messagePromises);
  }
  catch (error) {
    console.log(error);
    throw new Error('Error retrieving messages');
  }
}

export async function writeAttachmentToBucket(bucket: any, filename: string, contentType: string, data: any) {
  const stream = require('stream');
  const file = bucket.file(filename);
  const bufferStream = new stream.PassThrough();
  bufferStream.end(Buffer.from(data, 'base64'));
  bufferStream.pipe(file.createWriteStream({
    metadata: {
      contentType: contentType,
      metadata: {
        custom: 'metadata'
      }
    },
    public: false,
    validation: "md5"
  }))
  .on('error', function(error: any) {
    console.log(error);
  })
  .on('finish', function() {
    // The file upload is complete.
  });
}

export async function removeLabelsFromMessages(messages: GmailMessage[], label: string) {
  const gmail = await getGmailClient();
  const messagePromises = messages?.map(async (message) => {
    assert(message.id != undefined);
    const res = await gmail.users.threads.modify({
      userId: 'me',
      id: message.id,
      requestBody: {
        'removeLabelIds': [getEnv('GMAIL_LABEL_IN_QUEUE')]
      }
    });
    return res.data;
  }) || [];
  return await Promise.all(messagePromises);
}
