import { CompletedPart } from '@aws-sdk/client-s3';

export class PartUpload {
  uploadId: string;
}

export class CompleteUpload {
  uploadId: string;
  parts: CompletedPart[];
}
