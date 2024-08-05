import * as ff from '@google-cloud/functions-framework';
import { MessagePublishedData } from '@google/events/cloud/pubsub/v1/MessagePublishedData';
import NfeDocument, * as nfe from './nfe';
import assert from 'assert';
import BigQuery from '@google-cloud/bigquery';
import * as Ac from './util';
import * as Bq from './bigquery';

async function processEmailXml(cloudEvent: any): Promise<void> {
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

  const messages = await Ac.getMessages(
    'has:attachment filename:xml',
    Ac.getEnv('GMAIL_LABEL_IN_QUEUE'),
  );

  // Keeping this basic and procedural while working out the kinks.
  for (const message of messages) {
    if (message?.payload?.parts) {
      for (const part of message.payload.parts) {
        if (part?.body?.attachmentId && message.id) {
          const attachment = await gmail.users.messages.attachments.get({
            id: part.body.attachmentId,
            messageId: message.id,
            userId: 'me'
          });

          if (attachment?.data?.data && part?.filename) {
            try {
              if (!part.filename.endsWith('.xml')) {
                console.log(`INVALID: ${part.filename}`);
                continue;
              }
              console.log(`VALID: ${part.filename}`);
              const xml = Buffer.from(attachment.data.data, 'base64').toString();
              const nfeDocument = new NfeDocument(xml, part?.filename || 'a file');

              if (nfeDocument.isNfeValid()) {
                const invoiceRows: Bq.InvoiceRecord[] = [];
                const invoiceLinesRows: Bq.InvoiceRecordLine[] = [];
                invoiceRows.push({
                  nfeId: nfeDocument.getDocumentId(),
                  dateTime: nfeDocument.getDateTime(),
                  nfeType: nfeDocument.getType(),
                  supplierName: nfeDocument.getSupplierDisplayName(),
                  supplierId: nfeDocument.getSupplierId(),
                  invoiceNumber: nfeDocument.getInvoiceNumber(),
                  invoiceTotal: nfeDocument.getInvoiceTotal(),
                  description: nfeDocument.getInvoiceDescription()
                })

                await Bq.deleteAndInsertRecords('ac_ops_data', 'nfe-received-xml', invoiceRows);

                for (const line of nfeDocument.lineItems()) {
                  invoiceLinesRows.push(line);
                }
                await Bq.deleteAndInsertRecords('ac_ops_data', 'nfe-received-xml-lines', invoiceLinesRows);


                // Build an invoice row.
                // const bigqueryClient = Bq.getBigQueryClient();

              }

              //console.log(`${part.filename}: ${nfeDocument.getType()}`);
              //console.log(`${part.filename} dessctiption: ${nfeDocument.getInvoiceDescription()}`);
              // console.log([`${part.filename}`, 'yyy' + JSON.stringify(nfeDocument.supplier())]);
              // console.log([`${part.filename}`, 'zzz' + JSON.stringify(nfeDocument.lineItems())]);
              // console.log(nfeDocument.lineItems());
              // console.log();
              //console.log(`${part.filename} supplier id: ${nfeDocument.getSupplierId()}`);
              // console.log(`${part.filename} invoice id: ${nfeDocument.getInvoiceNumber()}`);
              //console.log(`${part.filename} invoice number: ${nfeDocument.getInvoiceNumber()}`);
              //console.log(`Finished ${part.filename}`);
              // console.log(nfeDocument.getInvoiceTotal());
              console.log(nfeDocument.getDocumentId());
            }
            catch (error) {
              console.log([`Error processing ${part.filename}`, error]);
            }
            console.log(`Finished: ${part.filename}`);
            // Ac.writeAttachmentToBucket(bucket, part.filename, 'application/xml', attachment.data.data);
          }
        }
      }
    }

    await Ac.removeLabelsFromMessages(messages, Ac.getEnv('GMAIL_LABEL_IN_QUEUE'));
  }
}

ff.cloudEvent('processEmailXml', processEmailXml);

export { processEmailXml };
