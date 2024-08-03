// https://gist.github.com/brauliodavid/3a80d2f4fbced8fdbbfe54232ae9fef4

import * as ff from '@google-cloud/functions-framework';
import { MessagePublishedData } from '@google/events/cloud/pubsub/v1/MessagePublishedData';
import * as Ac from './util';

async function processEmails(cloudEvent: any): Promise<void> {
  let pubsub: MessagePublishedData = cloudEvent.data ?? null;
  if (!pubsub || !pubsub?.message?.data) {
    console.log(['Unexpected data passed to cloud function:', cloudEvent]);
    return;
  }

  const message = JSON.parse(Buffer.from(pubsub.message.data, 'base64').toString());
  const historyId = message.historyId;
  // Ac.socialiseIt(`Email(s) were added to the ops queue (history ID: ${historyId})`);

  const [gmail, bucket] = await Promise.all([
    Ac.getGmailClient(),
    Ac.getBucket(Ac.getEnv('BUCKET_FOR_XML'))
  ]);

  // 1 Get threads.
  // feach thread
  //   2 Get thread
  //   feach message
  //     3 Get message
  //     feach part
  //       4 Get attachment
  //       5 Save attachment to bucket

  console.log(gmail);

  let results: any;
  console.log(Ac.getEnv('GMAIL_LABEL_IN_QUEUE'));
  try {
    results = await gmail.users.threads.list({
      userId: 'me',
      labelIds: [Ac.getEnv('GMAIL_LABEL_IN_QUEUE')],
    });
    console.log(results.data.threads);
  }
  catch (err: any) {
    console.log(err);
  }


  try {
    console.log('Threads are undefined here');
    const threads = results.data.threads;
    if (threads.length > 0) {
      for (const thread of threads) {
        console.log('a thread');
        console.log(thread);
        if (thread.id) {
          const threadBody = await gmail.users.threads.get({
            userId: 'me',
            id: thread.id,
          });

          let msgSubject = '';
          console.log(threadBody);
          if (threadBody?.data?.messages) {
            for (const message of threadBody.data.messages) {
              console.log('a message');
              console.log(message);
              if (message?.id) {
                const messageBody = await gmail.users.messages.get({
                  id: message.id,
                  userId: 'me'
                });

                if (messageBody?.data?.payload?.parts) {
                  console.log('a part');
                  console.log(messageBody.data.payload.parts);
                  for (const part of messageBody.data.payload.parts) {
                    if (part?.body?.attachmentId) {
                      const attachment = await gmail.users.messages.attachments.get({
                        id: part.body.attachmentId,
                        messageId: message.id,
                        userId: 'me'
                      });
                      console.log(attachment);

                      const stream = require('stream');
                      const bufferStream = new stream.PassThrough();
                      if (attachment?.data?.data) {
                        bufferStream.end(Buffer.from(attachment.data.data, 'base64'));
                      }

                      const file = bucket.file('incoming/' + part.filename);
                      bufferStream.pipe(file.createWriteStream({
                          metadata: {
                            contentType: 'application/xml',
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
                  }

                }
              }
            }
          }

          await gmail.users.threads.modify({
            userId: 'me',
            id: thread.id,
            requestBody: {
              'removeLabelIds': [Ac.getEnv('GMAIL_LABEL_IN_QUEUE')]
            }
          });
        }
      }
    }
  // The result contains an identifier for the message, `ts`.
  // console.log(`Successfully send message ${result.ts} in conversation`);
  } catch (error) {
    console.log(error);
  }

}

ff.cloudEvent('processEmails', processEmails);

export { processEmails };
