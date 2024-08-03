// https://gist.github.com/brauliodavid/3a80d2f4fbced8fdbbfe54232ae9fef4

import * as ff from '@google-cloud/functions-framework';
import { gmail_v1, google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { WebClient as SlackClient } from '@slack/web-api';
import { MessagePublishedData } from '@google/events/cloud/pubsub/v1/MessagePublishedData';
import { Storage } from '@google-cloud/storage';
import { Base64 } from 'js-base64';
import * as AcUtil from './util';
import * as fs from 'fs';

const SLACK_TOKEN: string = process.env.SLACK_TOKEN ?? '';
const SLACK_CHANNEL: string = process.env.SLACK_CHANNEL ?? '';
const GOOGLE_AUTH_SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const GMAIL_LABEL_IN_QUEUE: string = process.env.GMAIL_LABEL_IN_QUEUE ?? '';
const GMAIL_USER: string = process.env.GMAIL_USER ?? '';
const BUCKET_PROJECT = process.env.BUCKET_PROJECT ?? '';
const BUCKET_NAME = process.env.BUCKET_NAME ?? '';
const SERVICE_ACCOUNT_GMAIL = process.env.SERVICE_ACCOUNT_GMAIL ?? '';
const SERVICE_ACCOUNT_WAREHOUSE = process.env.SERVICE_ACCOUNT_WAREHOUSE ?? '';

console.log([
  SLACK_TOKEN,
  SLACK_CHANNEL,
  GMAIL_LABEL_IN_QUEUE,
  GMAIL_USER,
  BUCKET_PROJECT,
  BUCKET_NAME,
  SERVICE_ACCOUNT_GMAIL,
  SERVICE_ACCOUNT_WAREHOUSE
]);

console.log('Testing GMail user');
fs.readFile(`service-accounts/${SERVICE_ACCOUNT_GMAIL}`, logBuffer);
console.log('Testing Warehouse user');
fs.readFile(`service-accounts/${SERVICE_ACCOUNT_WAREHOUSE}`, logBuffer);

function logBuffer (err: any, data: any) {
  console.log(data.toString());
};

let authClient: any;
let bucket: any;

async function getAuthClient(): Promise<any> {
  if (authClient) {
    return authClient;
  }

  //keyFile: `service-accounts/${SERVICE_ACCOUNT_GMAIL}`,

  const auth = new GoogleAuth({
    keyFile: 'service-account.json',
    scopes: GOOGLE_AUTH_SCOPES,
    clientOptions: {
      subject: GMAIL_USER,
    }
  });

  authClient = await auth.getClient();
  return authClient;
}

async function getBucket(): Promise<any> {
  const storage = new Storage({
    projectId: BUCKET_PROJECT,
    keyFilename: `service-accounts/${SERVICE_ACCOUNT_WAREHOUSE}`
  });
  bucket = storage.bucket(BUCKET_NAME);
  return bucket;
}

async function processEmails(cloudEvent: any): Promise<void> {
  let pubsub: MessagePublishedData = cloudEvent.data ?? null;
  if (!pubsub || !pubsub?.message?.data) {
    console.log('Unexpected data passed to cloud function.');
    return;
  }

  const message = JSON.parse(Buffer.from(pubsub.message.data, 'base64').toString());
  const historyId = message.historyId;
  const slack = new SlackClient(SLACK_TOKEN);

  // const result = await slack.chat.postMessage({
  //   text: `Received history ID: ${historyId}`,
  //   channel: SLACK_CHANNEL,
  // });

  const authClient = await getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const bucket = await getBucket();
  const stream = require('stream');
  console.log('CCClets go boys');

  // We don't use the history id as we need to use the
  // previous history ID and we don't have it.
  // We just search by label.

  try {
    const results = await gmail.users.threads.list({
      userId: 'me',
      labelIds: [GMAIL_LABEL_IN_QUEUE],
    });

    // const threads = results.data.threads || [];
    // if (threads.length > 0) {
    //   for (const thread of threads) {
    //     console.log('a thread');
    //     console.log(thread);
    //     if (thread.id) {
    //       const threadBody = await gmail.users.threads.get({
    //         userId: 'me',
    //         id: thread.id,
    //       });

    //       let msgSubject = '';
    //       console.log(threadBody);
    //       if (threadBody?.data?.messages) {
    //         for (const message of threadBody.data.messages) {
    //           console.log('a message');
    //           console.log(message);
    //           if (message?.id) {
    //             const messageBody = await gmail.users.messages.get({
    //               id: message.id,
    //               userId: 'me'
    //             });

    //             if (messageBody?.data?.payload?.parts) {
    //               console.log('a part');
    //               console.log(messageBody.data.payload.parts);
    //               for (const part of messageBody.data.payload.parts) {
    //                 if (part?.body?.attachmentId) {
    //                   const attachment = await gmail.users.messages.attachments.get({
    //                     id: part.body.attachmentId,
    //                     messageId: message.id,
    //                     userId: 'me'
    //                   });
    //                   console.log(attachment);

    //                   const bufferStream = new stream.PassThrough();
    //                   if (attachment?.data?.data) {
    //                     bufferStream.end(Buffer.from(attachment.data.data, 'base64'));
    //                   }

    //                   const file = bucket.file('incoming/' + part.filename);
    //                   bufferStream.pipe(file.createWriteStream({
    //                       metadata: {
    //                         contentType: 'application/xml',
    //                         metadata: {
    //                           custom: 'metadata'
    //                         }
    //                       },
    //                       public: false,
    //                       validation: "md5"
    //                     }))
    //                     .on('error', function(error: any) {
    //                       console.log(error);
    //                     })
    //                     .on('finish', function() {
    //                       // The file upload is complete.
    //                     });

    //                 }
    //               }

    //             }
    //           }
    //         }
    //       }

    //       await gmail.users.threads.modify({
    //         userId: 'me',
    //         id: thread.id,
    //         requestBody: {
    //           'removeLabelIds': [GMAIL_LABEL_IN_QUEUE]
    //         }
    //       });
    //     }
    //   }
    // }
  // The result contains an identifier for the message, `ts`.
  // console.log(`Successfully send message ${result.ts} in conversation`);
  } catch (error) {
    console.log(error);
  }

}

ff.cloudEvent('processEmails', processEmails);

export { processEmails };
