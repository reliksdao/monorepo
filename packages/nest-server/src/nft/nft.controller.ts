import {
  Controller,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Param,
  ParseIntPipe,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { parse } from 'csv/sync'
import { z } from 'nestjs-zod/z'
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'
import { UserOwnsCollection } from 'src/collection/user-owns-collection.guard'
import { PrismaService } from 'src/prisma.service'
import { NftService } from './nft.service'
import { RecordSchema, NftAfterSanitationSchema } from './types'

@Controller('nft')
@UseGuards(JwtAuthGuard)
export class NftController {
  constructor(
    private nftService: NftService,
    private prismaService: PrismaService,
  ) {}

  @Post('/batch-create-metadata/:collectionId')
  @UseGuards(UserOwnsCollection)
  @UseInterceptors(FileInterceptor('file'))
  async batchCreateNftsMetadata(
    @UploadedFile() file: Express.Multer.File,
    @Param('collectionId', ParseIntPipe) collectionId: number,
  ) {
    const records = parse(file.buffer, {
      columns: (header) => {
        const capitalized = this.nftService.capitalizeHeader(header)
        return this.nftService.sanitizeRecordId(capitalized)
      },
      onRecord: (record) => {
        return Object.fromEntries(
          this.nftService.sanitizeRecordIdValues(
            Object.entries(record).filter(([, v]) => Boolean(v)),
          ),
        )
      },
    })
    const validatedRecords = z.array(RecordSchema).safeParse(records)

    if (!validatedRecords.success)
      throw new BadRequestException('ids have a non number value')

    const transformedRecords = this.nftService.transformRecordAttributes(
      validatedRecords.data,
    )

    const validatedTransformRecords = z
      .array(NftAfterSanitationSchema)
      .safeParse(transformedRecords)

    if (!validatedTransformRecords.success)
      throw new BadRequestException('attributes are incorrect')

    // 1. first delete all of the nfts
    await this.prismaService.collection.update({
      where: { id: collectionId },
      data: { Nft: { deleteMany: {} } },
    })

    // 2. Create all nfts
    await this.prismaService.collection.update({
      where: { id: collectionId },
      select: { _count: true },
      data: {
        Nft: {
          createMany: {
            data: validatedTransformRecords.data.map((nft) => ({
              tokenId: nft.id,
              attributes: nft.attributes,
            })),
          },
        },
      },
    })

    return { success: true }
  }
}