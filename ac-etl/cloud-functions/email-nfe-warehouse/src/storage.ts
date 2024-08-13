import assert from 'assert';
import * as Ac from './util';
import { Storage } from '@google-cloud/storage';

export async function getBucket(bucketName: string): Promise<any> {
  const keyFile: string = Ac.getEnv('SERVICE_ACCOUNT_WAREHOUSE');
  try {
    const storage = new Storage({
      projectId: Ac.getEnv('WAREHOUSE_PROJECT'),
      keyFilename: `service-accounts/${keyFile}`
    });
    const bucket = storage.bucket(bucketName);
    return bucket;
  }
  catch (error) {
    console.log([`Error get the bucket ${bucketName}:`, error]);
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
