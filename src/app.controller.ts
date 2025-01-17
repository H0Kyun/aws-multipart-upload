import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { AppService } from './app.service';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CompleteMultipartUploadCommandOutput,
  CreateMultipartUploadCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CompleteUpload, PartUpload } from './dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  private readonly _bucket = 'YOUR_BUCKET_NAME';
  private readonly _key = 'YOUR_FOLDER/';
  private readonly _region = 'YOUR_BUCKET_REGION';
  private readonly _map = new Map<string, string>();

  @Post('/start/:fileName')
  async getHello(@Param('fileName') fileName: string): Promise<string> {
    console.log('start');
    const Metadata: Record<string, string> = {
      ['uuid']: 'abdef',
    };
    const client = new S3Client({ region: this._region });
    const command = new CreateMultipartUploadCommand({
      Bucket: this._bucket,
      Key: this._key + fileName,
      Metadata: Metadata,
    });
    const response = await client.send(command);
    this._map.set(response.UploadId, fileName);
    return response.UploadId;
  }

  @Post('/pre-sign/:part')
  async createPresignedUrlWithClient(
    @Param('part', ParseIntPipe) partNum: number,
    @Body() dto: PartUpload,
  ): Promise<string> {
    console.log('part', partNum, dto.uploadId);
    const client = new S3Client({ region: this._region });
    const command = new UploadPartCommand({
      Bucket: this._bucket,
      Key: this._key + this._map.get(dto.uploadId),
      PartNumber: partNum,
      UploadId: dto.uploadId,
    });
    return getSignedUrl(client, command, { expiresIn: 3600 });
  }

  @Post('/complete')
  async complete(
    @Body() dto: CompleteUpload,
  ): Promise<CompleteMultipartUploadCommandOutput> {
    console.log('complete', dto);
    const client = new S3Client({ region: this._region });
    const command = new CompleteMultipartUploadCommand({
      Bucket: this._bucket,
      Key: this._key + this._map.get(dto.uploadId),
      MultipartUpload: {
        Parts: dto.parts,
      },
      UploadId: dto.uploadId,
    });
    let response;
    try {
      response = await client.send(command);
      console.log(response.Key);
      console.log(response.$metadata);
      console.log('good');
      this._map.delete(dto.uploadId);
    } catch (e) {
      console.log(e);
      throw e;
    }

    return response;
  }

  @Post('/abort/:uploadId')
  async abort(
    @Param('uploadId') uploadId: string,
  ): Promise<CompleteMultipartUploadCommandOutput> {
    console.log('abort', uploadId);
    const client = new S3Client({ region: this._region });
    const command = new AbortMultipartUploadCommand({
      Bucket: this._bucket,
      Key: this._key + this._map.get(uploadId),
      UploadId: uploadId,
    });

    const response = await client.send(command);
    this._map.delete(uploadId);

    return response;
  }
}
