import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { compareSync, genSaltSync, hashSync } from 'bcryptjs'
import { User } from '@prisma/client'
import { PrismaService } from 'src/prisma.service'
import { CredentialsDto } from './credentials-dto'
import { CryptoService } from 'src/crypto/crypto.service'
import { ethers } from 'ethers'
import { ArweaveService } from 'src/arweave/arweave.service'
import { JWKInterface } from 'arweave/node/lib/wallet'

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    private cryptoService: CryptoService,
    private arweaveService: ArweaveService,
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
    // Ethereum
    const ethersWallet = ethers.Wallet.createRandom()
    // Arweave
    const arweaveCredentials =
      await this.arweaveService.createArweaveCredentials()
    // User Info
    const hPassword = hashSync(password)
    const salt = genSaltSync()
    const ePrivateKey = await this.cryptoService.encryptEthPrivateKey(
      ethersWallet.privateKey,
      password,
      salt,
    )
    // Db transaction
    const user = await this.prismaService.user.create({
      data: {
        ePrivateKey,
        hPassword,
        publicAddress: ethersWallet.address,
        username,
        salt,
        arweaveAddress: arweaveCredentials.address,
        arweaveEncryptedPrivateKey:
          await this.cryptoService.encryptEthPrivateKey(
            JSON.stringify(arweaveCredentials.privateKey),
            password,
            salt,
          ),
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
    const user = await this.prismaService.user.findUniqueOrThrow({
      where: { username: username },
    })

    const privateArKey = await this.cryptoService.decryptEthPrivateKey(
      user.arweaveEncryptedPrivateKey,
      password,
      user.salt,
    )

    const privateKey = await this.cryptoService.decryptEthPrivateKey(
      user.ePrivateKey,
      password,
      user.salt,
    )

    return {
      privateKey,
      publicAddress: user.publicAddress,
      arweaveAddress: user.arweaveAddress,
      arweavePrivateKey: JSON.parse(privateArKey) as JWKInterface,
    }
  }

  async validateCredentials(username: string, password: string) {
    const user = await this.prismaService.user.findUnique({
      where: { username },
    })
    if (user && compareSync(password, user.hPassword)) {
      const {
        hPassword,
        ePrivateKey,
        arweaveEncryptedPrivateKey,
        salt,
        ...result
      } = user
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
