import { BigQuery } from '@google-cloud/bigquery';
import { GoogleAuth } from 'google-auth-library';
import * as Ac from './util';
import assert from 'assert';

let bigQuery: BigQuery | undefined;

export interface InvoiceRecord {
  nfeId: string; // An official NFe document identifier.
  dateTime: string; // The date and time when the invoice was issued, in ISO 8601 format.
  nfeType: string; // The type of NFe document, including various document types such as events and NFSe.
  supplierName: string; // The name of the supplier.
  supplierId: string; // A unique identifier for the supplier.
  invoiceNumber: string; // The invoice number.
  invoiceTotal: number; // The total amount of the invoice.
  description: string; // A description of the invoice.
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
}

export async function getBigQueryClient(): Promise<BigQuery> {
  if (bigQuery != undefined) {
    return bigQuery;
  }
  try {
    bigQuery = new BigQuery({
      projectId: Ac.getEnv('WAREHOUSE_PROJECT'),
      keyFilename: `service-accounts/${Ac.getEnv('SERVICE_ACCOUNT_WAREHOUSE')}`,
    });
  }
  catch (error) {
    console.log(error);
    throw new Error('Error getting BigQuery client.');
  }
  return bigQuery;
}

export async function deleteAndInsertRecords(datasetId: string, tableId: string, rows: any[]) {
  bigQuery = await getBigQueryClient();
  assert(typeof rows[0]?.nfeId == 'string');

  try {
    // Delete existing records with the same nfeId
    const deleteQuery = `
      DELETE FROM \`${datasetId}.${tableId}\`
      WHERE nfeId = @nfeId
    `;
    const options = {
      query: deleteQuery,
      params: { nfeId: rows[0].nfeId },
    };
    await bigQuery.query(options);
    console.log('Existing records deleted');

    try {
      await bigQuery.dataset(datasetId).table(tableId).insert(rows);
      console.log('Data inserted successfully');
    }
    catch (err: any) {
      if (err.name === 'PartialFailureError') {
        console.error('Big query error ' + JSON.stringify(err.errors));
      } else {
        console.error('Error:', err);
      }
    }

    console.log(`Inserted ${rows.length} rows`);
  }
  catch (error) {
    console.error('Error during delete and insert operation:', error);
  }
}
