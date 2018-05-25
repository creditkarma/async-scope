import * as AsyncHooks from '@creditkarma/async-hooks'

import {
    IAsyncMap,
    IAsyncNode,
    IAsyncOptions,
    IAsyncScope,
    ISizeProfile,
} from './types'

import * as logger from './logger'
import * as Utils from './utils'

import {
    MAX_SIZE,
    NODE_EXPIRATION,
    PURGE_INTERVAL,
} from './constants'

export class AsyncScope implements IAsyncScope {
    public static debug(msg: string, ...args: Array<any>): void {
        AsyncHooks.debug.info(msg, ...args)
    }

    private asyncMap: IAsyncMap
    private nodeExpiration: number
    private purgeInterval: number
    private maxSize: number
    private lastPurge: number
    private previousId: number
    private asyncHooks: AsyncHooks.IAsyncHooks

    constructor({
        nodeExpiration = NODE_EXPIRATION,
        purgeInterval = PURGE_INTERVAL,
        maxSize = MAX_SIZE,
        asyncHooks = AsyncHooks,
    }: IAsyncOptions = {}) {
        const self = this
        this.asyncMap = { size: 0, oldestId: -1 }
        this.nodeExpiration = nodeExpiration
        this.purgeInterval = purgeInterval
        this.maxSize = maxSize
        this.lastPurge = Date.now()
        this.previousId = -1
        this.asyncHooks = asyncHooks

        asyncHooks.createHook({
            init(asyncId: number, type: string, triggerAsyncId: number, resource: object) {
                const savedMap = self.asyncMap

                try {
                    // logger.log(`asyncId[${asyncId}], parentId[${triggerAsyncId}]`)
                    self._ensureNode(triggerAsyncId)

                    const parentNode: IAsyncNode | undefined = self.asyncMap[triggerAsyncId]
                    if (parentNode !== undefined) {
                        parentNode.children.push(asyncId)
                        parentNode.timestamp = Date.now()
                        self._addNode(asyncId, triggerAsyncId)
                    }

                    self._purge()

                // Log, reset, live to fight another day
                } catch (err) {
                    logger.error(`An error occurred while creating scope: `, err)
                    self.asyncMap = savedMap
                }
            },
            before(asyncId: number) {
                // logger.log(`before[${asyncId}]`)
                // Nothing to see here
            },
            after(asyncId: number) {
                const savedMap = self.asyncMap

                try {
                    // logger.log(`after[${asyncId}]`)
                    Utils.destroyNode(asyncId, self.asyncMap)
                    self._purge()

                // Log, reset, live to fight another day
                } catch (err) {
                    logger.error(`An error occurred while destroying scope with id[${asyncId}]: `, err)
                    self.asyncMap = savedMap
                }
            },
            promiseResolve(asyncId: number) {
                // logger.log(`promiseResolve[${asyncId}]`)
                // Nothing to see here
            },
            destroy(asyncId: number) {
                // logger.log(`destroy[${asyncId}]`)
                // Nothing to see here
            },
        }).enable()
    }

    public get<T>(key: string): T | null {
        const activeId: number = this.asyncHooks.executionAsyncId()
        this._ensureNode(activeId)
        return Utils.recursiveGet<T>(key, activeId, this.asyncMap)
    }

    public set<T>(key: string, value: T): void {
        const activeId: number = this.asyncHooks.executionAsyncId()
        this._ensureNode(activeId)
        const activeNode: IAsyncNode | undefined = this.asyncMap[activeId]
        if (activeNode !== undefined) {
            if (activeNode.data === undefined) {
                activeNode.data = {}
            }
            activeNode.data[key] = value
        }
    }

    public delete(key: string): void {
        const activeId: number = this.asyncHooks.executionAsyncId()
        Utils.recursiveDelete(key, activeId, this.asyncMap)
    }

    /**
     * A method for debugging, returns the lineage (parent scope ids) of the current scope
     */
    public lineage(): Array<number> {
        const activeId: number = this.asyncHooks.executionAsyncId()
        return Utils.lineageFor(activeId, this.asyncMap)
    }

    public size(): ISizeProfile {
        return {
            size: this.asyncMap.size,
            maxSize: this.maxSize,
        }
    }

    private _ensureNode(asyncId: number): void {
        if (this.asyncMap[asyncId] === undefined) {
            this._addNode(asyncId, null)
        }
    }

    private _addNode(asyncId: number, parentId: number | null): void {
        if (this.asyncMap[asyncId] === undefined) {
            if (this.asyncMap.size >= this.maxSize) {
                Utils.removeOldest(this.asyncMap)
            }

            this.asyncMap[asyncId] = {
                id: asyncId,
                timestamp: Date.now(),
                nextId: -1,
                previousId: this.previousId,
                parentId,
                exited: false,
                data: undefined,
                children: [],
            }

            // Set the initial oldest value
            if (this.asyncMap.oldestId === -1) {
                this.asyncMap.oldestId = asyncId
            }

            // Creates a chain for determining oldest node
            const previousNode: IAsyncNode | undefined = this.asyncMap[this.previousId]
            if (previousNode !== undefined) {
                previousNode.nextId = asyncId
            }

            // Keep track of previously added node for linking our chain
            this.previousId = asyncId

            // Increment map size
            this.asyncMap.size += 1
        }
    }

    private _purge(): void {
        const currentTime: number = Date.now()
        if ((currentTime - this.lastPurge) > this.purgeInterval) {
            this.lastPurge = currentTime
            Utils.runPurge(this.asyncMap, currentTime, this.nodeExpiration)
        }
    }
}
