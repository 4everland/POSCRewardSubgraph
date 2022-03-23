import { BigInt, ethereum } from '@graphprotocol/graph-ts'
import { Open, Close, Claim, SetNode, SetRewardPerBlock } from './types/POSCRewards/POSCRewards'
import { Holder, Pool, PoolSnapshot } from './types/schema'
import { contract } from './utils'

export function handleOpen(event: Open): void {
	const pid = event.params.pid
	upsetPool(pid)
	const holder = contract.holder(pid)
	const holderEntity = new Holder(holder.toHex())
	holderEntity.pool = pid.toString()
	holderEntity.node = contract.holders(holder).value1
	holderEntity.save()
}

export function handleClose(event: Close): void {
	const pid = event.params.pid
	upsetPool(pid)
}

export function handleClaim(event: Claim): void {
	const pid = event.params.pid
	upsetPool(pid)
}

export function handleSetNode(event: SetNode): void {
	const holderEntity = Holder.load(event.params.holder.toHex())
	if (holderEntity) {
		holderEntity.pool = event.params.pid.toString()
		holderEntity.node = event.params.node
		holderEntity.save()
	}
}

export function handleSetRewardPerBlock(event: SetRewardPerBlock): void {
	updateAllPools()
	snapshotAll(event.block.number)
}

export function handleBlock(block: ethereum.Block): void {
	updateAllPools()
	snapshotAll(block.number)
}

function updateAllPools(): void {
	const poolLength = contract.poolLength()
	for (let i = BigInt.fromU64(0); i.lt(poolLength); i = i.plus(BigInt.fromU64(1))) {
		upsetPool(i)
	}
}

function upsetPool(pid: BigInt): void {
	const pool = contract.pools(pid)
	const holder = pool.value0
	const open = pool.value1
	const close = pool.value2
	const lastUpdated = pool.value3
	const realised = pool.value4
	const claimed = pool.value5
	let poolEntity = Pool.load(pid.toString())
	if (!poolEntity) {
		poolEntity = new Pool(pid.toString())
	}
	poolEntity.holder = holder
	poolEntity.open = open
	poolEntity.close = close
	poolEntity.lastUpdated = lastUpdated
	poolEntity.realised = realised
	poolEntity.claimed = claimed
	poolEntity.available = contract.reward(pid)
	poolEntity.accumulated = contract.accumulatedReward(pid)
	const isClose = contract.isClosed(pid)
	poolEntity.status = isClose ? "close" : "open"
	poolEntity.save()

}

function snapshotAll(blockNumber: BigInt): void {
	const poolLength = contract.poolLength()
	if (!poolLength.equals(BigInt.zero())) {
		const id = blockNumber.toString()
		let snapshot = PoolSnapshot.load(id)
		if (!snapshot) {
			snapshot = new PoolSnapshot(id)
			snapshot.total = contract.poolLength()
			snapshot.block = blockNumber
			snapshot.rewardPerBlock = contract.rewardPerBlock()
			const pools: string[] = []
			for (let i = BigInt.fromU64(0); i.lt(poolLength); i = i.plus(BigInt.fromU64(1))) {
				pools.push(i.toString())
			}
			snapshot.pools = pools
			snapshot.save()
		}
	}

}
