import * as AsyncHooks from '@creditkarma/async-hooks'

export interface IAsyncScope {
    get<T>(key: string): T | null
    set<T>(key: string, value: T): void
    delete(key: string): void
}

export interface IAsyncOptions {
    nodeExpiration?: number
    purgeInterval?: number
}

interface IDictionary {
    [key: string]: any
}

interface IAsyncNode {
    id: number
    timestamp: number
    parentId: number | null
    exited: boolean
    data: IDictionary
    children: Array<number>
}

type AsyncMap = Map<number, IAsyncNode>

// Data has a ten minute expiration
const NODE_EXPIRATION: number = (1000 * 60 * 10)

// Purge data every 5 minutes
const PURGE_INTERVAL: number = (1000 * 60 * 5)

function cleanUpParents(asyncId: number, parentId: number, asyncMap: AsyncMap): void {
    const asyncNode: IAsyncNode | undefined = asyncMap.get(parentId)
    if (asyncNode !== undefined) {
        asyncNode.children = asyncNode.children.filter((next: number) => {
            return next !== asyncId
        })

        if (asyncNode.exited && asyncNode.children.length === 0) {
            const nextParentId: number | null = asyncNode.parentId
            if (nextParentId !== null) {
                asyncMap.delete(parentId)
                cleanUpParents(parentId, nextParentId, asyncMap)
            }
        }
    }
}

function recursiveGet<T>(key: string, asyncId: number, asyncMap: AsyncMap): T | null {
    const asyncNode: IAsyncNode | undefined = asyncMap.get(asyncId)
    if (asyncNode !== undefined) {
        if (asyncNode.data[key] !== undefined) {
            return asyncNode.data[key]

        } else {
            const parentId: number | null = asyncNode.parentId
            if (parentId !== null) {
                return recursiveGet<T>(key, parentId, asyncMap)
            } else {
                return null
            }
        }
    } else {
        return null
    }
}

function recursiveDelete(key: string, asyncId: number, asyncMap: AsyncMap): void {
    const asyncNode: IAsyncNode | undefined = asyncMap.get(asyncId)
    if (asyncNode !== undefined) {
        const parentId: number | null = asyncNode.parentId

        if (asyncNode.data[key] !== undefined) {
            asyncNode.data[key] = undefined
        }

        if (parentId !== null) {
            recursiveDelete(key, parentId, asyncMap)
        }
    }
}

function lineageFor(asyncId: number, asyncMap: AsyncMap): Array<number> {
    const asyncNode: IAsyncNode | undefined = asyncMap.get(asyncId)
    if (asyncNode !== undefined) {
        const parentId: number | null = asyncNode.parentId

        if (parentId !== null) {
            return [ asyncId, ...lineageFor(parentId, asyncMap) ]
        }
    }

    return [ asyncId ]
}

function destroyNode(asyncId: number, nodeToDestroy: IAsyncNode, asyncMap: AsyncMap): void {
    // Only delete if the the child scopes are not still active
    if (nodeToDestroy.children.length === 0) {
        const parentId: number | null = nodeToDestroy.parentId
        if (parentId !== null) {
            asyncMap.delete(asyncId)
            cleanUpParents(asyncId, parentId, asyncMap)
        }

    // If child scopes are still active mark this scope as exited so we can clean up
    // when child scopes do exit.
    } else {
        nodeToDestroy.exited = true
    }
}

function runPurge(asyncMap: AsyncMap, currentTime: number, ttl: number): void {
    if (ttl > 0) {
        const toPurge: Array<IAsyncNode> = []
        asyncMap.forEach((element: IAsyncNode) => {
            if ((currentTime - element.timestamp) > ttl) {
                AsyncHooks.debug('purge: ', element)
                toPurge.push(element)
            }
        })

        toPurge.forEach((element: IAsyncNode) => {
            destroyNode(element.id, element, asyncMap)
        })
    }
}

export class AsyncScope implements IAsyncScope {
    private asyncMap: Map<number, IAsyncNode>
    private nodeExpiration: number
    private purgeInterval: number
    private lastPurge: number

    constructor({
        nodeExpiration = NODE_EXPIRATION,
        purgeInterval = PURGE_INTERVAL,
    }: IAsyncOptions = {}) {
        const self = this
        this.asyncMap = new Map()
        this.nodeExpiration = nodeExpiration
        this.purgeInterval = purgeInterval
        this.lastPurge = Date.now()

        AsyncHooks.createHook({
            init(asyncId: number, type: string, triggerAsyncId: number, resource: object) {
                if (!self.asyncMap.has(triggerAsyncId)) {
                    self.addNode(triggerAsyncId, null)
                }

                const parentNode: IAsyncNode | undefined = self.asyncMap.get(triggerAsyncId)

                if (parentNode !== undefined) {
                    parentNode.children.push(asyncId)
                    parentNode.timestamp = Date.now()
                    self.addNode(asyncId, triggerAsyncId)
                }

                self.purge()

                // AsyncHooks.debug(`init[${asyncId}]: parent[${triggerAsyncId}]: `, self.asyncMap)
            },
            before(asyncId: number) {
                // AsyncHooks.debug('before: ', asyncId)
            },
            after(asyncId: number) {
                // AsyncHooks.debug('after: ', asyncId)
            },
            promiseResolve(asyncId: number) {
                // AsyncHooks.debug('promiseResolve: ', asyncId)
            },
            destroy(asyncId: number) {
                const nodeToDestroy = self.asyncMap.get(asyncId)
                if (nodeToDestroy !== undefined) {
                    destroyNode(asyncId, nodeToDestroy, self.asyncMap)
                }

                self.purge()
            },
        }).enable()
    }

    public get<T>(key: string): T | null {
        const activeId: number = AsyncHooks.executionAsyncId()
        this.addNode(activeId, null)
        return recursiveGet<T>(key, activeId, this.asyncMap)
    }

    public set<T>(key: string, value: T): void {
        const activeId: number = AsyncHooks.executionAsyncId()
        this.addNode(activeId, null)
        const activeNode: IAsyncNode | undefined = this.asyncMap.get(activeId)
        if (activeNode !== undefined) {
            activeNode.data[key] = value
        }
    }

    public delete(key: string): void {
        const activeId: number = AsyncHooks.executionAsyncId()
        recursiveDelete(key, activeId, this.asyncMap)
    }

    /**
     * A method for debugging, returns the lineage (parent scope ids) of the current scope
     */
    public lineage(): Array<number> {
        const activeId: number = AsyncHooks.executionAsyncId()
        return lineageFor(activeId, this.asyncMap)
    }

    private addNode(asyncId: number, parentId: number | null): void {
        if (!this.asyncMap.has(asyncId)) {
            this.asyncMap.set(asyncId, {
                id: asyncId,
                timestamp: Date.now(),
                parentId,
                exited: false,
                data: {},
                children: [],
            })
        }
    }

    private purge(): void {
        const currentTime: number = Date.now()
        if ((currentTime - this.lastPurge) > this.purgeInterval) {
            this.lastPurge = currentTime
            runPurge(this.asyncMap, currentTime, this.nodeExpiration)
        }
    }
}

// export const sharedScope: AsyncScope = new AsyncScope()
