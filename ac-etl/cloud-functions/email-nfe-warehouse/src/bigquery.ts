import { BigQuery } from '@google-cloud/bigquery';
import { GoogleAuth } from 'google-auth-library';
import * as Ac from './util';
import { BigQueryWriteClient } from '@google-cloud/bigquery-storage';
import assert from 'assert';
import protobuf from 'protobufjs';
import path from 'path';

let bigQuery: BigQuery | undefined;
const bigQueryWriteClient = new BigQueryWriteClient();

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

async function loadProtoSchema() {
  // Load the proto definition file. Adjust the path and the proto definition name as needed.
  const root = await protobuf.load(path.join(__dirname, 'path-to-your-proto-file', 'your-schema.proto'));
  return root.lookupType('RowType'); // Adjust 'RowType' to match your proto definition
}

async function writeToBigQueryStorage(datasetId: string, tableId: string, rows: any[], RowType: protobuf.Type) {
  const projectId = await bigQuery!.getProjectId();
  const writeStream = `projects/${projectId}/datasets/${datasetId}/tables/${tableId}/streams/_default`;

  const protoRows = rows.map(row => {
    const errMsg = RowType.verify(row);
    if (errMsg) throw Error(errMsg);

    const message = RowType.create(row);
    return RowType.encode(message).finish();
  });

  const request = {
    writeStream,
    protoRows: {
      rows: protoRows.map(protoRow => ({
        serializedRows: [protoRow],
      })),
    },
  };

  await bigQueryWriteClient.appendRows(request);
  console.log('Rows successfully written to BigQuery');
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

    // Load the protobuf schema
    const RowType = await loadProtoSchema();

    // Insert new records using BigQuery Storage Write API
    try {
      await writeToBigQueryStorage(datasetId, tableId, rows, RowType);
      console.log('Data inserted successfully');
    }
    catch (err: any) {
      console.error('Error inserting data:', err);
    }

    console.log(`Inserted ${rows.length} rows`);
  }
  catch (error) {
    console.error('Error during delete and insert operation:', error);
  }
}