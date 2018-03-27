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

function runPurge(asyncMap: AsyncMap, ttl: number): void {
    const currentTime: number = Date.now()
    const toPurge: Array<IAsyncNode> = []
    asyncMap.forEach((element: IAsyncNode) => {
        if ((currentTime - element.timestamp) > ttl) {
            toPurge.push(element)
        }
    })

    toPurge.forEach((element: IAsyncNode) => {
        destroyNode(element.id, element, asyncMap)
    })
}

// This will periodically remove long-lived nodes to prevent excess memory usage
function schedulePurge(asyncMap: AsyncMap, interval: number, ttl: number): NodeJS.Timer {
    return setTimeout(() => {
        runPurge(asyncMap, ttl)
        schedulePurge(asyncMap, interval, ttl)
    }, PURGE_INTERVAL)
}

export class AsyncScope implements IAsyncScope {
    private asyncMap: Map<number, IAsyncNode>
    private asyncHooks: AsyncHooks.IAsyncHook
    private enabled: boolean = false
    private timer: NodeJS.Timer | undefined
    private nodeExpiration: number
    private purgeInterval: number

    constructor({
        nodeExpiration = NODE_EXPIRATION,
        purgeInterval = PURGE_INTERVAL,
    }: IAsyncOptions = {}) {
        const self = this
        this.asyncMap = new Map()
        this.nodeExpiration = nodeExpiration
        this.purgeInterval = purgeInterval

        this.asyncHooks = AsyncHooks.createHook({
            init(asyncId: number, type: string, triggerAsyncId: number, resource: object) {
                // AsyncHooks.debug('init: ', type)
                const currentTime: number = Date.now()

                if (!self.asyncMap.has(triggerAsyncId)) {
                    self.asyncMap.set(triggerAsyncId, {
                        id: triggerAsyncId,
                        timestamp: currentTime,
                        parentId: null,
                        exited: false,
                        data: {},
                        children: [],
                    })
                }

                const parentNode: IAsyncNode | undefined = self.asyncMap.get(triggerAsyncId)

                if (parentNode !== undefined) {
                    parentNode.children.push(asyncId)
                    parentNode.timestamp = currentTime

                    self.asyncMap.set(asyncId, {
                        id: asyncId,
                        timestamp: currentTime,
                        parentId: triggerAsyncId,
                        exited: false,
                        data: {},
                        children: [],
                    })
                }
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
            },
        })
    }

    public enable(): void {
        if (!this.enabled) {
            this.enabled = true
            this.asyncHooks.enable()
            this.timer = schedulePurge(this.asyncMap, this.purgeInterval, this.nodeExpiration)
        }
    }

    public disable(): void {
        if (this.enabled) {
            this.enabled = false
            this.asyncHooks.disable()
            runPurge(this.asyncMap, this.nodeExpiration)
        }

        if (this.timer !== undefined) {
            clearTimeout(this.timer)
        }
    }

    public get<T>(key: string): T | null {
        this.enable()
        const activeId: number = AsyncHooks.executionAsyncId()
        return recursiveGet<T>(key, activeId, this.asyncMap)
    }

    public set<T>(key: string, value: T): void {
        this.enable()
        const activeId: number = AsyncHooks.executionAsyncId()
        const activeNode: IAsyncNode | undefined = this.asyncMap.get(activeId)
        if (activeNode !== undefined) {
            activeNode.data[key] = value
        }
    }

    public delete(key: string): void {
        this.enable()
        const activeId: number = AsyncHooks.executionAsyncId()
        recursiveDelete(key, activeId, this.asyncMap)
    }

    /**
     * A method for debugging, returns the lineage (parent scope ids) of the current scope
     */
    public lineage(): Array<number> {
        this.enable()
        const activeId: number = AsyncHooks.executionAsyncId()
        return lineageFor(activeId, this.asyncMap)
    }
}

export const sharedScope: AsyncScope = new AsyncScope()
