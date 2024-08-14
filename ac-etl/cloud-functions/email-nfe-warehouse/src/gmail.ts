import assert from 'assert';
import * as Ac from './util';
import { GoogleAuth } from 'google-auth-library';
import { gmail_v1, google } from 'googleapis';

type GmailListMessagesResponse = gmail_v1.Schema$ListMessagesResponse;
type GmailMessage = gmail_v1.Schema$Message;

let gmail: gmail_v1.Gmail | undefined;

/**
 * For test with assert.
 */
function isGmailMessage(data: any): data is GmailMessage {
  return typeof data === 'object' &&
    data !== null &&
    typeof data.id === 'string' &&
    typeof data.snippet === 'string' &&
    typeof data.threadId === 'string';
}

/**
 * For test with assert.
 */
function isGmailListMessages(data: any): data is GmailListMessagesResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    (Array.isArray(data.messages) && data.messages.every((message: { id: string; threadId: string; }) =>
      typeof message.id === 'string' && typeof message.threadId === 'string')) &&
    (data.nextPageToken === undefined || typeof data.nextPageToken === 'string') &&
    (data.resultSizeEstimate === undefined || typeof data.resultSizeEstimate === 'number')
  );
}

async function getAuthClient(keyFile: string, gmailUser: string, authScopes: string[]): Promise<any> {
  try {
    const serviceAccountKey = await Ac.getSecret(Ac.getEnv('SECRET_ACCOUNT_FOR_GMAIL'));
    const auth = new GoogleAuth({
      credentials: JSON.parse(serviceAccountKey),
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
      'na',
      Ac.getEnv('GMAIL_USER'),
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

/**
 * Add and remove labels.
 */
export async function updateMessageLabels(messages: GmailMessage[], removeLabel: string, addLabel: string) {
  const gmail = await getGmailClient();
  const messagePromises = messages?.map(async (message) => {
    assert(message.id != undefined);
    const res = await gmail.users.threads.modify({
      userId: 'me',
      id: message?.threadId || '',
      requestBody: {
        'removeLabelIds': [removeLabel],
        'addLabelIds': [addLabel],
      }
    });
    return res.data;
  }) || [];
  console.log(`Updating labels for ${messages.length} email(s).`);
  return await Promise.all(messagePromises);
}

/**
 * Get messages by label.
 */
export async function getMessages(query: string = '', label: string): Promise<GmailMessage[]> {
  const gmail = await getGmailClient();
  const res = await gmail.users.messages.list({
    userId: 'me',
    labelIds: [label],
    q: query,
  });

  try {
    assert(isGmailListMessages(res.data) == true);
    assert(Ac.isIterable(res.data.messages));
  }
  catch (error) {
    if (res.data.resultSizeEstimate == undefined ) {
      console.log("Not iterable?", res.data);
      throw new Error("Messages from Gmail were not iterable gmail messages. See log.");
    }
    return [];
  }

  // Sort messages by threadId.
  res.data.messages.sort((a, b) => {
    const threadA = a.threadId || '';
    const threadB = b.threadId || '';
    return threadA.localeCompare(threadB);
  });

  // For situations with a lot of results. Trim the results back.
  let lastThreadId = '';
  let messagesToProcess: any = [];
  for (const message of res.data.messages) {
    assert(message.id != undefined && message.threadId != undefined);
    if (lastThreadId == message.threadId || messagesToProcess.length < 20) {
      messagesToProcess.push(message);
    }
    else {
      console.log(`Not processing too many messages, stopped at ${messagesToProcess.length}`)
      break;
    }
    lastThreadId = message.threadId;
  }

  try {
    // We deal with a small volume of messages, usually there will only
    // be one. But this should be batched rather than loading one by one.
    const messagePromises = messagesToProcess.map(async (message: { id: undefined; }) => {
      assert(message.id != undefined);
      const res = await gmail.users.messages.get({
        id: message.id,
        userId: 'me',
      });
      // Not quite prepared to assert on this yet.
      if (!isGmailMessage(res.data)) {
        console.log(["Probably fatal.. there a gmail message in this response?", res]);
      }
      return res.data;
    }) || [];
    return await Promise.all(messagePromises);
  }
  catch (error) {
    console.log(error);
    throw new Error("Failed to load all gmail messages.")
  }
}
