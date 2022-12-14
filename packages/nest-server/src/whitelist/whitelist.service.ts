import { Injectable } from '@nestjs/common'
import { keccak256 } from 'ethers/lib/utils'
import { MerkleTree } from 'merkletreejs'

@Injectable()
export class WhitelistService {
  constructMerkeTree(inviteList: string[]) {
    const leaves = inviteList.map(keccak256)
    return new MerkleTree(leaves, keccak256, {
      sort: true,
    })
  }

  computeRoot(inviteList: string[]) {
    const tree = this.constructMerkeTree(inviteList)
    return tree.getHexRoot()
  }

  getProof(inviteList: string[], address: string) {
    const tree = this.constructMerkeTree(inviteList)
    const leaf = keccak256(address)
    return tree.getHexProof(leaf)
  }

  isAddressPartOfInviteList(inviteList: string[], address: string) {
    return inviteList.includes(address)
  }
}
