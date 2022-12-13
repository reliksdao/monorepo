import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { compareSync, hashSync } from 'bcryptjs'
import { User } from '@prisma/client'
import { PrismaService } from 'src/prisma.service'
import { CredentialsDto } from './credentials-dto'
import { CryptoService } from 'src/crypto/crypto.service'
import { ethers } from 'ethers'

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    private cryptoService: CryptoService,
  ) {}

  getUser(id: number) {
    return this.prismaService.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        publicAddress: true,
      },
    })
  }

  async createUser(credentials: CredentialsDto) {
    const { username, password } = credentials
    const newWallet = ethers.Wallet.createRandom()
    const publicAddress = newWallet.address
    const hPassword = hashSync(password)
    const ePrivateKey = await this.cryptoService.encryptEthPrivateKey(
      newWallet.privateKey,
      password,
    )
    const user = await this.prismaService.user.create({
      data: {
        ePrivateKey,
        hPassword,
        publicAddress,
        username,
      },
      select: { id: true, username: true },
    })
    return {
      access_token: this.jwtService.sign({
        username: user.username,
        sub: user.id,
      }),
    }
  }

  async ejectUser({ username, password }: CredentialsDto) {
    const { ePrivateKey, publicAddress } =
      await this.prismaService.user.findUniqueOrThrow({
        where: { username: username },
        select: { ePrivateKey: true, publicAddress: true },
      })

    const privateKey = await this.cryptoService.decryptEthPrivateKey(
      ePrivateKey,
      password,
    )
    return { privateKey, publicAddress }
  }

  async validateCredentials(username: string, password: string) {
    const user = await this.prismaService.user.findUnique({
      where: { username },
    })
    if (user && compareSync(password, user.hPassword)) {
      const { hPassword, ePrivateKey, ...result } = user
      return result
    }
    return null
  }

  async loginUser(user: User) {
    const payload = { username: user.username, sub: user.id }
    return {
      access_token: this.jwtService.sign(payload),
    }
  }

  async isUserOwnCollection(userId: number, collectionId: number) {
    const collection = await this.prismaService.collection.findUnique({
      where: { id: collectionId },
    })
    if (!collection || collection.userId !== userId) return false
    return true
  }
}
