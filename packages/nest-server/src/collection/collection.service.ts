import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { CollectionDto } from './collection-dto'

@Injectable()
export class CollectionService {
  constructor(private prismaService: PrismaService) {}

  async createCollection(collectionDto: CollectionDto, studioId: number) {
    const isCollectionExists = await this.prismaService.collection.findUnique({
      where: { name: collectionDto.name },
    })
    if (isCollectionExists)
      throw new BadRequestException('collection already exists')
    const createdCollection = await this.prismaService.collection.create({
      data: { ...collectionDto, studioId },
    })
    return createdCollection
  }

  // async updateCollection(collectionDto: CollectionDto, collectionId: number) {}
}