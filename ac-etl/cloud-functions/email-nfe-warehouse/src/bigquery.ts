import { BigQuery } from '@google-cloud/bigquery';
import assert from 'assert';
import * as Ac from './util';

let bigQuery: BigQuery | undefined;

export interface InvoiceRecord {
  nfeId: string; // An official NFe document identifier.
  dateTime: string; // The date and time when the invoice was issued, in ISO 8601 format.
  nfeType: string; // The type of NFe document, including various document types such as events and NFSe.
  supplierName: string; // The name of the supplier.
  supplierId: string; // A unique identifier for the supplier.
  invoiceNumber: string; // The invoice number.
  invoiceTotal: number; // The total amount of the invoice.
  description: string;
  batchSequence: number; // A description of the invoice.
}

export interface InvoiceRecordLine {
  nfeId: string; // An official NFe document identifier
  lineNumber: number; // Line number
  itemCode: string; // As defined by the supplier
  itemDesc: string; // Description of the item, which might change from invoice to invoice, used for ML
  cfop: string; // A four-digit Brazilian NFe code
  unitCode: string; // Unit code
  unitQty: number; // Unit quantity
  unitPrice: number; // Unit price
  lineTotal: number; // Line total
  batchSequence: number;
}

export async function getBigQueryClient(): Promise<BigQuery> {
  if (bigQuery != undefined) {
    return bigQuery;
  }
  try {
    bigQuery = new BigQuery({
      projectId: Ac.getEnv('WAREHOUSE_PROJECT'),
      keyFilename: `service-accounts/${Ac.getEnv('SERVICE_ACCOUNT_WAREHOUSE')}`,
      location: 'southamerica-east1',
    });
  }
  catch (error) {
    console.log(error);
    throw new Error('Error getting BigQuery client.');
  }
  return bigQuery;
}

export async function insertInvoiceRecords(invoices: InvoiceRecord[], invoiceLines: InvoiceRecordLine[], logId: string) {
  bigQuery = await getBigQueryClient();
  const datasetId: string = 'ac_ops_data';
  const invoiceTableId = 'nfe-received-xml';
  const invoiceLinesTableId = 'nfe-received-xml-lines';
  try {
    assert(typeof invoices[0]?.nfeId == 'string');
  }
  catch (error) {
    console.log(`${logId}: Unexpected invoice ID, dumping all rows.`, invoices);
    return;
  }

  try {
    await bigQuery.dataset(datasetId).table(invoiceLinesTableId).insert(invoiceLines);
    console.log(`${logId}/Inserted ${invoiceLines.length} invoice lines`);
    await bigQuery.dataset(datasetId).table(invoiceTableId).insert(invoices);
    console.log(`${logId}/Inserted ${invoices.length} invoice headers`);
  }
  catch (err: any) {
    if (err.name === 'PartialFailureError') {
      console.error(`${logId}/BigQuery PartialFailureError` + JSON.stringify(err.errors));
    } else {
      console.error(`${logId}/BigQuery other error:`, err);
    }
  }
}
