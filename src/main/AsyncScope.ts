import * as AsyncHooks from '@creditkarma/async-hooks'

import {
    IAsyncMap,
    IAsyncNode,
    IAsyncOptions,
    IAsyncScope,
} from './types'

import * as Utils from './utils'

import {
    MAX_SIZE,
    NODE_EXPIRATION,
    PURGE_INTERVAL,
} from './constants'

export class AsyncScope implements IAsyncScope {
    public static debug(msg: string, ...args: Array<any>): void {
        AsyncHooks.debug(msg, ...args)
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
                // AsyncScope.debug(`asyncId[${asyncId}], parentId[${triggerAsyncId}]`)
                if (self.asyncMap[triggerAsyncId] === undefined) {
                    self.addNode(triggerAsyncId, null)
                }

                const parentNode: IAsyncNode | undefined = self.asyncMap[triggerAsyncId]
                if (parentNode !== undefined) {
                    parentNode.children.push(asyncId)
                    parentNode.timestamp = Date.now()
                    self.addNode(asyncId, triggerAsyncId)
                }

                // Set the initial oldest value
                if (self.asyncMap.oldestId === -1) {
                    self.asyncMap.oldestId = asyncId
                }

                const previousNode: IAsyncNode | undefined = self.asyncMap[self.previousId]
                if (previousNode !== undefined) {
                    previousNode.nextId = asyncId
                }

                self.previousId = asyncId

                self.purge()
            },
            before(asyncId: number) {
                // AsyncScope.debug(`before[${asyncId}]`)
                // Nothing to see here
            },
            after(asyncId: number) {
                // AsyncScope.debug(`after[${asyncId}]`)
                Utils.destroyNode(asyncId, self.asyncMap)

                self.purge()
            },
            promiseResolve(asyncId: number) {
                // AsyncScope.debug(`promiseResolve[${asyncId}]`)
                // Nothing to see here
            },
            destroy(asyncId: number) {
                // AsyncScope.debug(`destroy[${asyncId}]`)
                // Nothing to see here
            },
        }).enable()
    }

    public get<T>(key: string): T | null {
        const activeId: number = this.asyncHooks.executionAsyncId()
        this.addNode(activeId, null)
        return Utils.recursiveGet<T>(key, activeId, this.asyncMap)
    }

    public set<T>(key: string, value: T): void {
        const activeId: number = this.asyncHooks.executionAsyncId()
        this.addNode(activeId, null)
        const activeNode: IAsyncNode | undefined = this.asyncMap[activeId]
        if (activeNode !== undefined) {
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

    private removeOldest(): void {
        const oldestId: number = this.asyncMap.oldestId
        const nodeToDelete: IAsyncNode | undefined = this.asyncMap[oldestId]
        if (nodeToDelete !== undefined) {
            delete this.asyncMap[this.asyncMap.oldestId]
            this.asyncMap.oldestId = nodeToDelete.nextId

            if (nodeToDelete.parentId !== null) {
                const parentNode: IAsyncNode | undefined = this.asyncMap[nodeToDelete.parentId]
                if (parentNode !== undefined) {
                    parentNode.children.splice(parentNode.children.indexOf(oldestId), 1)
                }
            }
        }
    }

    private addNode(asyncId: number, parentId: number | null): void {
        if (this.asyncMap[asyncId] === undefined) {
            if (this.asyncMap.size < this.maxSize) {
                this.asyncMap.size += 1
            } else {
                this.removeOldest()
            }

            this.asyncMap[asyncId] = {
                id: asyncId,
                timestamp: Date.now(),
                nextId: -1,
                parentId,
                exited: false,
                data: {},
                children: [],
            }
        }
    }

    private purge(): void {
        const currentTime: number = Date.now()
        if ((currentTime - this.lastPurge) > this.purgeInterval) {
            this.lastPurge = currentTime
            Utils.runPurge(this.asyncMap, currentTime, this.nodeExpiration)
        }
    }
}
